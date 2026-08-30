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
