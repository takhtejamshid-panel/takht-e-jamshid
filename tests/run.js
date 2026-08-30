/* ==========================================================================
   run.js — تست یکپارچه‌ی پنل تخت جمشید روی Miniflare (شبیه‌ساز Cloudflare)
   اجرا: node tests/run.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const net = require('net');
const { Miniflare } = require('miniflare');

/* SHA-224 را مستقیماً از سورسِ پنل می‌گیریم تا تست با همان پیاده‌سازی باشد */
const UTILS_BUNDLE = path.join(__dirname, '.utils.bundle.js');
fs.writeFileSync(
  UTILS_BUNDLE,
  fs.readFileSync(path.join(__dirname, '..', 'src', '02_utils.js'), 'utf8')
    .replace(/^import\s+.*$/m, '') + '\nmodule.exports = { sha224Hex };\n'
);
const { sha224Hex } = require(UTILS_BUNDLE);

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
function section(t) { console.log('\n▸ ' + t); }

/* یک سرور TCP محلی ساده برای آزمودن مسیر پروکسی */
function startEchoServer() {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on('data', (d) => {
        // پاسخ HTTP کوچک برای اطمینان از عبور داده
        socket.write(Buffer.concat([Buffer.from('ECHO:'), d]));
      });
      socket.on('error', () => {});
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* ساخت سرآیند VLESS معتبر */
function buildVlessHeader(uuid, host, port, payload) {
  const hex = uuid.replace(/-/g, '');
  const uuidBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) uuidBytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  const hostBytes = Buffer.from(host, 'utf8');
  const head = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(uuidBytes),
    Buffer.from([0]),                 // طول addon
    Buffer.from([1]),                 // فرمان TCP
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    Buffer.from([2]),                 // نوع آدرس: دامنه
    Buffer.from([hostBytes.length]),
    hostBytes,
  ]);
  return Buffer.concat([head, Buffer.from(payload || '')]);
}

function buildTrojanHeader(password, host, port, payload) {
  const hex = sha224Hex(password);                 // ۵۶ کاراکتر هگز
  const hostBytes = Buffer.from(host, 'utf8');
  return Buffer.concat([
    Buffer.from(hex, 'ascii'),
    Buffer.from([0x0d, 0x0a]),                     // CRLF
    Buffer.from([0x01]),                           // CMD: TCP
    Buffer.from([0x03]),                           // ATYP: دامنه
    Buffer.from([hostBytes.length]),
    hostBytes,
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    Buffer.from([0x0d, 0x0a]),                     // CRLF
    Buffer.from(payload || ''),
  ]);
}

/* ------------------------------------------------------------------ */
section('نحویِ اسکریپتِ سمتِ کلاینت');
{
  const vm = require('vm');
  const ui = fs.readFileSync(path.join(ROOT, 'src', '08_ui.js'), 'utf8');
  const mm = ui.match(/const\s+CLIENT_JS\s*=\s*\[([\s\S]*?)\n\s*\]\.join\(\s*'\\n'\s*\);/);
  ok('بلوک CLIENT_JS در رابط یافت می‌شود', !!mm);
  let csrc = null, cerr = null;
  if (mm) {
    try { csrc = eval('[' + mm[1] + ']').join('\n'); } catch (e) { cerr = e.message; }
    ok('رشته‌های CLIENT_JS معتبرند', !cerr, cerr || '');
  }
  ok('اسکریپت کلاینت استخراج می‌شود', !!csrc);
  if (csrc) {
    let serr = null;
    try { new vm.Script('(function(){' + csrc + '\n})'); } catch (e) { serr = e.message; }
    ok('اسکریپت کلاینت نحویِ سالم دارد', !serr, serr || '');
    /* نسخه‌ی باندل باید با package.json یکی باشد */
  {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const bundle = fs.readFileSync(path.join(ROOT, '_worker.js'), 'utf8');
    const m = bundle.match(/const VERSION\s*=\s*'([^']*)'/);
    ok('نسخه‌ی باندل با package.json همگام است',
      m && m[1] === pkg.version, (m ? m[1] : 'یافت نشد') + ' در برابر ' + pkg.version);
  }

  ok('تب اسکنر در رابط حضور دارد',
      ui.includes('page-scanner') && ui.includes('sc-progress') && ui.includes('sc-body') &&
      csrc.includes('function startScan'));
    ok('تابع‌های اسکنر تعریف شده‌اند',
      csrc.includes('function renderScanRows') && csrc.includes('function updateScanProgress') &&
      csrc.includes('function scSorted') && csrc.includes('function applyScan'));
  }
}

(async () => {


  const { server, port } = await startEchoServer();

  const mf = new Miniflare({
    scriptPath: path.join(ROOT, '_worker.js'),
    modules: true,
    compatibilityDate: '2024-09-23',
    d1Databases: { DB: 'takht-test' },
    bindings: { },
  });

  const BASE = 'http://panel.test';
  let cookie = '';
  const req = (p, init) => mf.dispatchFetch(BASE + p, Object.assign({ redirect: 'manual' }, init || {}));
  const reqAbs = (u, init) => mf.dispatchFetch(u, Object.assign({ redirect: 'manual' }, init || {}));

  try {
    /* ---------------------------------------------------------------- */
    section('استتار و مسیرهای عمومی');
    let r = await req('/');
    ok('صفحه اصلی پاسخ می‌دهد', r.status === 200, 'status=' + r.status);
    let t1 = await r.text();
    ok('صفحه اصلی استتار است (نه پنل)', t1.includes('Persepolis') && !t1.includes('tj_sid'));

    r = await req('/takht');
    ok('مسیر مخفی بدون نشست، استتار است', r.status === 200 && (await r.text()).includes('Persepolis'));

    r = await req('/takht/dash');
    ok('داشبورد بدون نشست به ورود هدایت می‌شود', r.status === 303 || r.status === 302, 'status=' + r.status);
    ok('مکان هدایت درست است', (r.headers.get('location') || '').includes('/takht/login'));

    /* ---------------------------------------------------------------- */
    section('احراز هویت');
    r = await req('/takht/login');
    ok('صفحه ورود نمایش داده می‌شود', r.status === 200 && (await r.text()).includes('تخت جمشید'));

    r = await req('/takht/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'user=admin&pass=wrong',
    });
    ok('ورود با گذرواژه اشتباه رد می‌شود', r.status === 401, 'status=' + r.status);

    r = await req('/takht/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'user=dariush&pass=admin',
    });
    const setCookie = r.headers.get('set-cookie') || '';
    cookie = setCookie.split(';')[0];
    ok('ورود پیش‌فرض موفق است', r.status === 303, 'status=' + r.status);
    ok('کوکی نشست صادر می‌شود', cookie.startsWith('tj_sid='), cookie.slice(0, 24));
    ok('کوکی HttpOnly و Secure است', /HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie));

    const auth = (p, init) => {
      const i = init || {};
      return req(p, Object.assign({}, i, { headers: Object.assign({ cookie }, i.headers || {}) }));
    };

    r = await auth('/takht/dash');
    ok('داشبورد با نشست معتبر باز می‌شود', r.status === 200, 'status=' + r.status);
    let html = await r.text();
    ok('داشبورد شامل المان‌های تم است', html.includes('تخت جمشید') && html.includes('--gold'));
    ok('داشبورد شامل همه تب‌هاست',
      ['overview', 'users', 'endpoints', 'settings', 'network', 'telegram', 'logs', 'backup', 'help']
        .every(x => html.includes('page-' + x)));

    r = await req('/takht/api/state');
    ok('دسترسی به API بدون نشست ممنوع است', r.status === 401, 'status=' + r.status);

    /* ---------------------------------------------------------------- */
    section('وضعیت و کاربر پیش‌فرض');
    r = await auth('/takht/api/state');
    let j = await r.json();
    ok('دریافت وضعیت موفق است', j.ok === true);
    ok('کاربر پیش‌فرض ساخته شده', Array.isArray(j.users) && j.users.length === 1, JSON.stringify(j.users && j.users.length));
    ok('نام کاربر پیش‌فرض «داریوش» است', j.users[0] && j.users[0].name === 'داریوش');
    ok('UUID کاربر معتبر است', j.users[0] && /^[0-9a-f-]{36}$/.test(j.users[0].uuid));

    /* ---------------------------------------------------------------- */
    section('مدیریت کاربران');
    r = await auth('/takht/api/users/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'کوروش', quota: '10GB', expireDays: 30, deviceLimit: 3 }),
    });
    j = await r.json();
    ok('ایجاد کاربر موفق است', j.ok === true, JSON.stringify(j));

    r = await auth('/takht/api/state');
    j = await r.json();
    const kurosh = (j.users || []).find(u => u.name === 'کوروش');
    const dariush = (j.users || []).find(u => u.name === 'داریوش');
    ok('دو کاربر وجود دارد', (j.users || []).length === 2);
    ok('سهمیه به بایت تبدیل شده', kurosh && kurosh.quota === 10 * 1024 ** 3, kurosh && String(kurosh.quota));
    ok('تاریخ انقضا حدود ۳۰ روز است', kurosh && Math.abs((kurosh.expireAt - Date.now()) / 86400000 - 30) < 0.01);
    ok('محدودیت دستگاه ذخیره شده', kurosh && kurosh.deviceLimit === 3);
    ok('کاربر پیش‌فرض بدون سهمیه است', dariush && dariush.quota === 0);

    const kid = kurosh.id;
    r = await auth('/takht/api/users/update', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: kid, name: 'کوروش بزرگ', quota: '20GB' }),
    });
    j = await r.json();
    ok('ویرایش کاربر موفق است', j.ok === true);

    /* ---------------------------------------------------------------- */
    section('لینک اشتراک و کد QR');
    r = await auth('/takht/api/link/' + kid);
    j = await r.json();
    ok('دریافت لینک اشتراک موفق است', j.ok === true && /\/takht\/sub\/[0-9a-f]+$/.test(j.url || ''), j.url);
    ok('تعداد نودها محاسبه شده', j.count >= 1, String(j.count));
    const subUrl = j.url;
    const token = subUrl.split('/').pop();

    r = await auth('/takht/api/qr/' + kid);
    j = await r.json();
    ok('تولید کد QR موفق است', j.ok === true && String(j.qr || '').startsWith('data:image/svg+xml;base64,'));

    /* ---------------------------------------------------------------- */
    section('خروجی اشتراک برای کلاینت‌ها');
    r = await reqAbs(subUrl);
    let body = await r.text();
    ok('اشتراک پیش‌فرض base64 است', r.status === 200 && !body.includes('vless://'));
    let decoded = Buffer.from(body.trim(), 'base64').toString('utf8');
    ok('رمزگشایی base64 شامل لینک VLESS است', decoded.includes('vless://'));
    ok('رمزگشایی base64 شامل لینک Trojan است', decoded.includes('trojan://'));
    ok('پارامتر type=ws در لینک‌ها هست', decoded.includes('type=ws'));
    ok('پارامتر security=tls در لینک‌ها هست', decoded.includes('security=tls'));
    ok('هدر subscription-userinfo ارسال می‌شود', !!r.headers.get('subscription-userinfo'));
    ok('هدر شامل سهمیه است', (r.headers.get('subscription-userinfo') || '').includes('total=21474836480'));

    r = await reqAbs(subUrl + '?format=clash');
    let yaml = await r.text();
    ok('خروجی Clash تولید می‌شود', yaml.includes('proxies:') && yaml.includes('type: vless') && yaml.includes('type: trojan'));
    ok('خروجی Clash شامل گروه انتخاب است', yaml.includes('proxy-groups:') && yaml.includes('type: select'));
    ok('خروجی Clash شامل ws-opts است', yaml.includes('ws-opts:') && yaml.includes('Host:'));

    r = await reqAbs(subUrl + '?format=singbox');
    let sb = await r.json().catch(() => null);
    ok('خروجی Sing-box JSON معتبر است', sb && Array.isArray(sb.outbounds));
    ok('خروجی Sing-box شامل vless است', sb && sb.outbounds.some(o => o.type === 'vless'));
    ok('خروجی Sing-box شامل trojan است', sb && sb.outbounds.some(o => o.type === 'trojan'));
    ok('خروجی Sing-box دارای selector است', sb && sb.outbounds.some(o => o.type === 'selector'));
    ok('transport ws با early data تنظیم شده',
      sb && sb.outbounds.some(o => o.transport && o.transport.type === 'ws' && o.transport.max_early_data === 2048));

    /* ---------------------------------------------------------------- */
    section('TLS بر پایه‌ی پورت (رفعِ نودهای همیشه‌خراب)');
    /* کلادفلر روی پورت ۸۰ فقط HTTPِ ساده می‌دهد؛ نوشتنِ security=tls برای آن
       باعث می‌شود کلاینت دست‌تکانیِ TLS بفرستد و اتصال کاملاً شکست بخورد. */
    const lines = decoded.split('\n').filter(Boolean);
    const nodeOf = (port) => lines.filter(l => new RegExp(':(?:' + port + ')\\?').test(l));
    const secOf = (l) => (l.match(/security=([a-z]+)/) || [])[1];

    const n80 = nodeOf(80);
    const n443 = nodeOf(443);
    ok('برای هر پروتکل یک نود روی پورت ۸۰ هست', n80.length === 2, 'تعداد=' + n80.length);
    ok('پورت ۸۰ بدون TLS است',
      n80.length === 2 && n80.every(l => secOf(l) === 'none'),
      n80.map(secOf).join(','));
    ok('پورت ۴۴۳ با TLS است',
      n443.length === 2 && n443.every(l => secOf(l) === 'tls'),
      n443.map(secOf).join(','));
    /* پورت‌های HTTPSِ پشتیبانی‌شده‌ی کلادفلر باید TLS داشته باشند */
    for (const p of [2053, 2083, 2087, 2096, 8443]) {
      const ns = nodeOf(p);
      ok('پورت ' + p + ' با TLS است',
        ns.length === 2 && ns.every(l => secOf(l) === 'tls'), ns.map(secOf).join(','));
    }
    ok('لینکِ بدون TLS پارامتر sni/fp ندارد',
      n80.every(l => !l.includes('sni=') && !l.includes('fp=')),
      n80[0] || '');

    /* Clash و Sing-box هم باید همین را رعایت کنند */
    const yamlLines = yaml.split('\n');
    let clashPort = null, clashTls = null, found80 = false;
    for (let i = 0; i < yamlLines.length; i++) {
      const m = yamlLines[i].match(/^\s+port:\s*(\d+)\s*$/);
      if (m) { clashPort = Number(m[1]); clashTls = null; }
      const t = yamlLines[i].match(/^\s+tls:\s*(true|false)\s*$/);
      if (t && clashPort !== null) {
        clashTls = t[1] === 'true';
        if (clashPort === 80) { found80 = true; ok('Clash: پورت ۸۰ بدون TLS است', clashTls === false); }
        clashPort = null;
      }
    }
    ok('Clash نودِ پورت ۸۰ را دارد', found80);

    const sb80 = (sb.outbounds || []).filter(o => o.server_port === 80);
    ok('Sing-box نودِ پورت ۸۰ را دارد', sb80.length === 2, 'تعداد=' + sb80.length);
    ok('Sing-box برای پورت ۸۰ بلوکِ tls نمی‌سازد',
      sb80.length === 2 && sb80.every(o => !o.tls),
      JSON.stringify(sb80.map(o => !!o.tls)));
    ok('Sing-box برای پورت ۴۴۳ بلوکِ tls دارد',
      (sb.outbounds || []).filter(o => o.server_port === 443).every(o => o.tls && o.tls.enabled === true));

    r = await reqAbs(subUrl + '?format=raw');
    let raw = await r.text();
    ok('خروجی متن خام تولید می‌شود', raw.split('\n').length >= 2 && raw.includes('vless://'));

    r = await reqAbs(subUrl + '?page=1');
    let page = await r.text();
    ok('صفحه وضعیت کاربر نمایش داده می‌شود', page.includes('کوروش') && page.includes('qrbox'));
    ok('صفحه وضعیت شامل QR است', page.includes('data:image/svg+xml;base64,'));

    r = await req('/takht/sub/نامعتبر');
    ok('توکن نامعتبر خطا می‌دهد', r.status === 404, 'status=' + r.status);

    /* ---------------------------------------------------------------- */
    section('آی‌پی تمیز');
    r = await auth('/takht/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cleanIPs: ['1.1.1.1#آلمان', '8.8.8.8#US'] }),
    });
    j = await r.json();
    ok('تنظیمات ذخیره می‌شود', j.ok === true);
    r = await reqAbs(subUrl + '?format=raw');
    raw = await r.text();
    ok('کانفیگ برای هر آی‌پی تمیز تولید می‌شود', raw.includes('1.1.1.1') && raw.includes('8.8.8.8'));
    ok('SNI همچنان دامنه است', raw.includes('sni=panel.test') || raw.includes('sni=panel'));

    /* ---------------------------------------------------------------- */
    section('اسکنر آی‌پی تمیز');
    /* بازه‌های رسمی IPv4 کلودفلر (همان‌هایی که در src/11_scanner.js است) */
    const CF_NETS = [
      [173, 245, 48, 20], [103, 21, 244, 22], [103, 22, 200, 22], [103, 31, 4, 22],
      [141, 101, 64, 18], [108, 162, 192, 18], [190, 93, 240, 20], [188, 114, 96, 20],
      [197, 234, 240, 22], [198, 41, 128, 17], [162, 158, 0, 15], [104, 16, 0, 13],
      [104, 24, 0, 14], [172, 64, 0, 13], [131, 0, 72, 22],
    ];
    const inCF = (ip) => {
      const o = String(ip).split('.').map(Number);
      if (o.length !== 4 || o.some((n) => !(n >= 0 && n <= 255))) return false;
      const u = ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
      return CF_NETS.some((nt) => {
        const base = ((nt[0] * 256 + nt[1]) * 256 + nt[2]) * 256;
        return u >= base && u < base + Math.pow(2, 32 - nt[3]);
      });
    };
    const post = (path_, body) => auth(path_, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });

    r = await post('/takht/api/scan/candidates', { count: 24, mode: 'spread' });
    j = await r.json();
    ok('کاندیداها تولید می‌شوند',
      j.ok === true && Array.isArray(j.ips) && j.ips.length === 24, JSON.stringify(j).slice(0, 120));
    const cand = (j.ips || []).slice();
    ok('همه‌ی کاندیداها در بازه‌های رسمی کلودفلرند', cand.length === 24 && cand.every(inCF));
    ok('کاندیداها یکتا هستند', new Set(cand).size === cand.length);

    r = await post('/takht/api/scan/candidates', { count: 10, mode: 'random', seed: 12345 });
    const seedA = await r.json();
    r = await post('/takht/api/scan/candidates', { count: 10, mode: 'random', seed: 12345 });
    const seedB = await r.json();
    ok('نمونه‌برداری با seed یکسان، یکسان است',
      JSON.stringify(seedA.ips) === JSON.stringify(seedB.ips) && (seedA.ips || []).length === 10);

    r = await post('/takht/api/scan/candidates', { count: 5, mode: 'random', seed: 777 });
    const seedC = await r.json();
    ok('seed متفاوت، نتیجه‌ی متفاوت می‌دهد',
      JSON.stringify(seedC.ips) !== JSON.stringify(seedA.ips));

    r = await post('/takht/api/scan/probe', { ips: cand.slice(0, 3), concurrency: 3, timeout: 3000 });
    j = await r.json();
    ok('پاسخ پروب ساختار درست دارد',
      j.ok === true && Array.isArray(j.results) && j.results.length === 3 &&
      j.results.every((x) => x && typeof x.ip === 'string' && typeof x.ok === 'boolean'),
      JSON.stringify(j).slice(0, 160));
    ok('ترتیب و هویت آی‌پی‌ها حفظ می‌شود',
      JSON.stringify((j.results || []).map((x) => x.ip)) === JSON.stringify(cand.slice(0, 3)));

    /* ذخیره با waitUntil انجام می‌شود؛ کمی صبر می‌کنیم */
    let items = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      r = await auth('/takht/api/scan/cache');
      j = await r.json();
      items = j.items || [];
      if (items.length >= 3) break;
      await new Promise((res) => setTimeout(res, 150));
    }
    ok('حافظه‌ی اسکن خوانده می‌شود',
      Array.isArray(items) && items.length >= 3, 'تعداد=' + items.length);
    ok('هر رکورد حافظه آی‌پی معتبر دارد', items.length > 0 && items.every((x) => inCF(x.ip)));

    const goodIPs = items.filter((x) => x.ok).map((x) => x.ip);
    if (goodIPs.length) {
      r = await post('/takht/api/scan/apply', { ips: goodIPs.slice(0, 2), replace: true });
      j = await r.json();
      ok('اعمال نتایج روی تنظیمات',
        j.ok === true && Array.isArray(j.cleanIPs) && j.cleanIPs.length >= 1 && j.cleanIPs.length <= 2,
        JSON.stringify(j).slice(0, 160));
      ok('آی‌پیِ اعمال‌شده معتبر است',
        (j.cleanIPs || []).every((e) => inCF(String(e).split('#')[0])));
      ok('برچسب دیتاسنتر ضمیمه می‌شود',
        (j.cleanIPs || []).every((e) => String(e).indexOf('#') > 0 || goodIPs.indexOf(String(e).split('#')[0]) >= 0));
    } else {
      ok('اعمال نتایج روی تنظیمات', true, 'رد شد: نتیجه‌ی موفقی در این محیط نبود');
    }

    r = await post('/takht/api/scan/apply', { ips: [] });
    j = await r.json();
    ok('اعمال با فهرست خالی رد می‌شود', j.ok === false);

    r = await post('/takht/api/scan/clear', {});
    j = await r.json();
    ok('پاک‌سازی حافظه‌ی اسکن', j.ok === true);
    r = await auth('/takht/api/scan/cache');
    j = await r.json();
    ok('حافظه پس از پاک‌سازی خالی است', j.ok === true && (j.items || []).length === 0);

    /* بازگرداندن تنظیمات آی‌پی تمیز برای بخش‌های بعدی */
    await post('/takht/api/settings', { cleanIPs: ['1.1.1.1#آلمان', '8.8.8.8#US'] });


    /* ---------------------------------------------------------------- */
    section('تغییر مسیر مخفی و پروتکل');
    r = await auth('/takht/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route: 'پارسه' }),
    });
    j = await r.json();
    ok('مسیر نامعتبر (غیرلاتین) رد می‌شود', j.ok === false, JSON.stringify(j));

    r = await auth('/takht/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route: 'persepolis', protocol: 'vless' }),
    });
    j = await r.json();
    ok('تغییر مسیر مخفی موفق است', j.ok === true && j.route === 'persepolis', JSON.stringify(j));

    r = await auth('/persepolis/api/state');
    ok('API روی مسیر جدید کار می‌کند', r.status === 200);
    r = await req('/takht/api/state');
    ok('مسیر قدیم دیگر استتار است', r.status === 200 && (await r.text()).includes('Persepolis'));
    r = await req('/persepolis/sub/' + token + '?format=raw');
    raw = await r.text();
    // مسیر در لینک به‌صورت Percent-encoded است: path=%2Fpersepolis%2F<token>%3Fed%3D2048
    ok('پس از تغییر مسیر، کانفیگ به‌روز است',
      raw.includes('path=%2Fpersepolis%2F') && raw.includes('%3Fed%3D2048'), raw.slice(0, 120));
    ok('مسیر قبلی در کانفیگ باقی نمانده', !raw.includes('%2Ftakht%2F'));
    ok('فقط پروتکل VLESS صادر می‌شود', raw.includes('vless://') && !raw.includes('trojan://'));

    /* ---------------------------------------------------------------- */
    section('گزارش‌ها و پشتیبان');
    r = await auth('/persepolis/api/logs');
    j = await r.json();
    ok('دریافت گزارش‌ها موفق است', j.ok === true && Array.isArray(j.logs));
    ok('رویدادها ثبت شده‌اند', j.logs.length > 0, String(j.logs.length));
    ok('ورود ناموفق ثبت شده', j.logs.some(l => l.message.includes('ورود ناموفق')));

    r = await auth('/persepolis/api/backup/export');
    j = await r.json();
    ok('خروجی پشتیبان تولید می‌شود', j.app === 'takht-e-jamshid' && Array.isArray(j.users) && j.users.length === 2);
    ok('پشتیبان شامل تنظیمات است', !!j.settings && j.settings.route === 'persepolis');

    /* ---------------------------------------------------------------- */
    section('هسته پروکسی (WebSocket)');
    r = await auth('/persepolis/api/state');
    j = await r.json();
    const du = (j.users || []).find(u => u.name === 'داریوش') || j.users[0];
    const uuid = du.uuid;

    const header = buildVlessHeader(uuid, '127.0.0.1', port, 'HELLO-TAKHT');
    const wsRes = await req('/persepolis', {
      headers: { upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', connection: 'Upgrade' },
    });
    ok('ارتقا به WebSocket پذیرفته می‌شود', wsRes.status === 101 && !!wsRes.webSocket, 'status=' + wsRes.status);

    /* پژواکِ زیرپروتکل: اگر کلاینت Sec-WebSocket-Protocol بفرستد (برای early data)
       و سرور آن را برنگرداند، کلاینت‌های سخت‌گیر اتصال را رد می‌کنند. */
    const edProto = Buffer.from('EARLY-DATA-TEST').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const wsEd = await req('/persepolis', {
      headers: {
        upgrade: 'websocket',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        connection: 'Upgrade',
        'sec-websocket-protocol': edProto,
      },
    });
    ok('ارتقا با Sec-WebSocket-Protocol پذیرفته می‌شود', wsEd.status === 101, 'status=' + wsEd.status);
    ok('زیرپروتکل در پاسخ پژواک می‌شود',
      (wsEd.headers.get('sec-websocket-protocol') || '') === edProto,
      'دریافت‌شده: ' + JSON.stringify(wsEd.headers.get('sec-websocket-protocol')));
    if (wsEd.webSocket) { try { wsEd.webSocket.close(); } catch (e) {} }

    /* بدون زیرپروتکل نباید چیزی برگردد */
    const wsPlain = await req('/persepolis', {
      headers: { upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', connection: 'Upgrade' },
    });
    ok('بدون زیرپروتکل، هدرِ اضافه‌ای فرستاده نمی‌شود',
      wsPlain.status === 101 && !wsPlain.headers.get('sec-websocket-protocol'),
      String(wsPlain.headers.get('sec-websocket-protocol')));
    if (wsPlain.webSocket) { try { wsPlain.webSocket.close(); } catch (e) {} }

    if (wsRes.webSocket) {
      const ws = wsRes.webSocket;
      ws.accept();
      const received = await new Promise((resolve) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => resolve(buf), 4000);
        ws.addEventListener('message', (e) => {
          buf = Buffer.concat([buf, Buffer.from(e.data)]);
          if (buf.length >= 2 + 5 + 11) { clearTimeout(timer); resolve(buf); }
        });
        ws.send(header);
      });
      const text = received.toString('utf8');
      ok('پاسخ پروکسی دریافت می‌شود', received.length > 0, 'len=' + received.length);
      ok('سرآیند پاسخ VLESS درست است', received[0] === 0 && received[1] === 0);
      ok('داده از مقصد بازمی‌گردد (ECHO)', text.includes('ECHO:HELLO-TAKHT'), JSON.stringify(text.slice(0, 60)));
      try { ws.close(); } catch (e) {}
    }

    /* کاربر ناشناس نباید پذیرفته شود */
    const badHeader = buildVlessHeader('00000000-0000-4000-8000-000000000000', '127.0.0.1', port, 'X');
    const wsBad = await req('/persepolis', {
      headers: { upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', connection: 'Upgrade' },
    });
    if (wsBad.webSocket) {
      const ws2 = wsBad.webSocket;
      ws2.accept();
      const got = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 2500);
        ws2.addEventListener('message', () => { clearTimeout(timer); resolve(true); });
        ws2.addEventListener('close', () => { clearTimeout(timer); resolve(false); });
        ws2.send(badHeader);
      });
      ok('UUID ناشناس رد می‌شود', got === false);
      try { ws2.close(); } catch (e) {}
    } else {
      ok('UUID ناشناس رد می‌شود', false, 'وب‌سوکت برقرار نشد');
    }

    /* کیل‌سوئیچ */
    await auth('/persepolis/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ killSwitch: true }),
    });
    r = await req('/persepolis', {
      headers: { upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', connection: 'Upgrade' },
    });
    ok('کیل‌سوئیچ ترافیک را متوقف می‌کند', r.status === 503, 'status=' + r.status);
    await auth('/persepolis/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ killSwitch: false }),
    });

    /* ---------------------------------------------------------------- */
    section('پروتکل Trojan');
    r = await auth('/persepolis/api/state');
    j = await r.json();
    const tUser = (j.users || [])[0];
    const trojanBefore = tUser ? tUser.used : 0;

    const trojanHeader = buildTrojanHeader(tUser.trojanPass, '127.0.0.1', port, 'TROJAN-TEST');
    const wsT = await req('/persepolis', {
      headers: { upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', connection: 'Upgrade' },
    });
    ok('اتصال Trojan برقرار می‌شود', wsT.status === 101 && !!wsT.webSocket, 'status=' + wsT.status);
    if (wsT.webSocket) {
      const ws3 = wsT.webSocket;
      ws3.accept();
      const got = await new Promise((resolve) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => resolve(buf), 4000);
        ws3.addEventListener('message', (e) => {
          buf = Buffer.concat([buf, Buffer.from(e.data)]);
          if (buf.length >= 16) { clearTimeout(timer); resolve(buf); }
        });
        ws3.send(trojanHeader);
      });
      const txt = got.toString('utf8');
      ok('داده از مقصد بازمی‌گردد', txt.includes('ECHO:TROJAN-TEST'), JSON.stringify(txt.slice(0, 60)));
      ok('پاسخ Trojan بدون سرآیند اضافی است', txt.startsWith('ECHO:'), JSON.stringify(txt.slice(0, 12)));
      try { ws3.close(); } catch (e) {}
    }

    /* رمز اشتباه نباید پذیرفته شود */
    const badTrojan = buildTrojanHeader('wrong-password', '127.0.0.1', port, 'X');
    const wsT2 = await req('/persepolis', {
      headers: { upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', connection: 'Upgrade' },
    });
    if (wsT2.webSocket) {
      const ws4 = wsT2.webSocket;
      ws4.accept();
      const got = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 2500);
        ws4.addEventListener('message', () => { clearTimeout(timer); resolve(true); });
        ws4.addEventListener('close', () => { clearTimeout(timer); resolve(false); });
        ws4.send(badTrojan);
      });
      ok('رمز Trojan اشتباه رد می‌شود', got === false);
      try { ws4.close(); } catch (e) {}
    } else {
      ok('رمز Trojan اشتباه رد می‌شود', false, 'وب‌سوکت برقرار نشد');
    }

    /* ---------------------------------------------------------------- */
    section('شمارش مصرف');
    await new Promise(res => setTimeout(res, 700));
    r = await auth('/persepolis/api/state');
    j = await r.json();
    const tAfter = (j.users || []).find(u => u.id === tUser.id);
    ok('مصرف کاربرِ Trojan ثبت می‌شود', tAfter && tAfter.used > trojanBefore,
      'قبل=' + trojanBefore + ' بعد=' + (tAfter && tAfter.used));
    ok('مقدار مصرف معقول است (نه دوبار‌شماری)',
      tAfter && (tAfter.used - trojanBefore) > 0 && (tAfter.used - trojanBefore) < 4096,
      'مقدار=' + (tAfter ? tAfter.used - trojanBefore : '?'));

    const vAfter = (j.users || []).find(u => u.name === 'داریوش');
    ok('مصرف کاربرِ VLESS نیز ثبت می‌شود', vAfter && vAfter.used > 0,
      'مقدار=' + (vAfter && vAfter.used));

    /* ---------------------------------------------------------------- */
    section('تلگرام');
    r = await req('/persepolis/tg', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: { chat: { id: 1 }, text: '/help' } }) });
    ok('وب‌هوک تلگرام بدون فعال‌سازی بی‌خطر است', r.status === 200, 'status=' + r.status);

    /* ---------------------------------------------------------------- */
    section('تغییر گذرواژه و نشست');
    r = await auth('/persepolis/api/password', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'abc' }),
    });
    j = await r.json();
    ok('گذرواژه کوتاه رد می‌شود', j.ok === false);

    r = await auth('/persepolis/api/password', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'persepolis-1404' }),
    });
    j = await r.json();
    ok('تغییر گذرواژه موفق است', j.ok === true);

    r = await req('/persepolis/login', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'user=dariush&pass=admin',
    });
    ok('گذرواژه قدیمی دیگر کار نمی‌کند', r.status === 401, 'status=' + r.status);

    r = await req('/persepolis/login', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'user=dariush&pass=persepolis-1404',
    });
    ok('گذرواژه جدید کار می‌کند', r.status === 303, 'status=' + r.status);
    ok('نشست قبلی باطل شده است', (await auth('/persepolis/api/state')).status === 401);

    /* ---------------------------------------------------------------- */
    section('بازیابی پشتیبان');
    r = await req('/persepolis/login', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'user=dariush&pass=persepolis-1404',
    });
    cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    r = await auth('/persepolis/api/backup/import', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app: 'takht-e-jamshid', version: '0.1.0', settings: { route: 'persepolis', protocol: 'both' }, users: [{ id: 'a1', name: 'بازیابی', uuid: '11111111-2222-4333-8444-555555555555', token: 'abcdefabcdef', quota: 1073741824, used: 5, createdAt: Date.now() }] }),
    });
    j = await r.json();
    ok('بازیابی پشتیبان موفق است', j.ok === true, JSON.stringify(j));
    r = await auth('/persepolis/api/state');
    j = await r.json();
    ok('پس از بازیابی فقط کاربر جدید هست', j.users.length === 1 && j.users[0].name === 'بازیابی');
    ok('پروتکل بازیابی شده', j.settings.protocol === 'both');

  } catch (e) {
    fail++;
    failures.push('استثنا: ' + (e && e.stack ? e.stack : e));
    console.log('\n✗ استثنا: ' + (e && e.stack ? e.stack : e));
  } finally {
    await mf.dispose();
    server.close();
    try { fs.unlinkSync(UTILS_BUNDLE); } catch (e) {}
  }

  console.log('\n' + '='.repeat(58));
  console.log('نتیجه: ' + pass + ' موفق · ' + fail + ' ناموفق');
  if (failures.length) {
    console.log('\nموارد ناموفق:');
    for (const f of failures) console.log('  • ' + f);
  }
  console.log('='.repeat(58));
  process.exit(fail === 0 ? 0 : 1);
})();
