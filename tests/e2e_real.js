/* ==========================================================================
   e2e_real.js — تستِ واقعیِ سرتاسر روی Cloudflare

   برخلافِ tests/run.js که در شبیه‌ساز اجرا می‌شود، این فایل به یک Workerِ
   واقعی روی workers.dev وصل می‌شود، دست‌تکانیِ VLESS/Trojan می‌فرستد و
   یک درخواستِ HTTP واقعی را از تونل عبور می‌دهد.

   استفاده:
     node tests/e2e_real.js [host] [uuid] [trojanPass]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('undici');

/* sha224Hex را مستقیماً از سورسِ پنل می‌گیریم */
const UTILS = path.join(__dirname, '.utils.bundle.js');
fs.writeFileSync(
  UTILS,
  fs.readFileSync(path.join(__dirname, '..', 'src', '02_utils.js'), 'utf8')
    .replace(/^import\s+.*$/m, '') + '\nmodule.exports = { sha224Hex };\n'
);
const { sha224Hex } = require(UTILS);

const HOST = process.argv[2] || process.env.E2E_HOST || 'takht-e2e-test.amirhesamfathalian7.workers.dev';
const UUID = process.argv[3] || 'b1e0a2c4-6f8d-4a3b-9c2e-1d5f7a9b3c60';
const PASS = process.argv[4] || 'e2e-test-pass';

/* انتخابِ مقصد دو شرط دارد:
   ۱) پشتِ کلادفلر نباشد — چون کلادفلر اتصالِ TCP به سایت‌هایی که خودش
      جلویشان است را نمی‌پذیرد («cannot connect ... consider using fetch»)
      و آن‌وقت تست به‌اشتباه شکست می‌خورد.
   ۲) از لبه سریع و پایدار باشد. اندازه‌گیری روی لبه (هر کدام ۸ تلاش):
        debian.org   ۸/۸ ·   ۹ms
        wikipedia.org ۸/۸ ·  ۵۳ms
        neverssl.com ۷/۸ · ۱۸۶۸ms  ← کند و گاهی وقت‌بر؛ باعث نوسانِ تست می‌شود */
const TARGET = process.env.E2E_TARGET || 'debian.org';
const REQ = 'GET / HTTP/1.1\r\nHost: ' + TARGET + '\r\nUser-Agent: takht-e2e/1.0\r\nAccept: */*\r\nConnection: close\r\n\r\n';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}

/* --------------------------- سرآیندها --------------------------- */
function buildVlessHeader(uuid, host, port, payload) {
  const hex = uuid.replace(/-/g, '');
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  const h = Buffer.from(host, 'utf8');
  return Buffer.concat([
    Buffer.from([0]), Buffer.from(b), Buffer.from([0]),
    Buffer.from([1]),
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    Buffer.from([2]), Buffer.from([h.length]), h,
    Buffer.from(payload || ''),
  ]);
}

function buildTrojanHeader(password, host, port, payload) {
  const hex = sha224Hex(password);
  const h = Buffer.from(host, 'utf8');
  return Buffer.concat([
    Buffer.from(hex, 'ascii'), Buffer.from([0x0d, 0x0a]),
    Buffer.from([0x01]), Buffer.from([0x03]),
    Buffer.from([h.length]), h,
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    Buffer.from([0x0d, 0x0a]),
    Buffer.from(payload || ''),
  ]);
}

/* --------------------------- اجرای یک تلاش --------------------------- */
function attempt(opts) {
  const { label, proto, port, tls, earlyData, path } = opts;
  return new Promise((resolve) => {
    const scheme = tls ? 'wss' : 'ws';
    const url = scheme + '://' + HOST + ':' + port + (path || '/takht');
    const payload = proto === 'vless'
      ? buildVlessHeader(UUID, TARGET, 80, REQ)
      : buildTrojanHeader(PASS, TARGET, 80, REQ);

    const protocols = [];
    if (earlyData) {
      /* داده‌ی زودهنگام: سرآیند در Sec-WebSocket-Protocol به‌صورت base64url */
      protocols.push(payload.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    }

    let ws;
    try {
      ws = protocols.length ? new WebSocket(url, protocols) : new WebSocket(url);
    } catch (e) {
      ok(label, false, 'ساختِ اتصال: ' + e.message);
      return resolve();
    }

    const chunks = [];
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { ws.close(); } catch (e) {}
      ok(label, false, 'مهلت تمام شد (' + chunks.length + ' بسته)');
      resolve();
    }, 25000);

    const toBuf = async (data) => {
      if (data == null) return Buffer.alloc(0);
      if (Buffer.isBuffer(data)) return data;
      if (data instanceof ArrayBuffer) return Buffer.from(data);
      if (data instanceof Uint8Array) return Buffer.from(data);
      if (Array.isArray(data)) return Buffer.concat(data.map(Buffer.from));
      if (typeof data.arrayBuffer === 'function') return Buffer.from(await data.arrayBuffer());
      if (typeof data === 'string') return Buffer.from(data, 'binary');
      return Buffer.from(String(data));
    };

    ws.addEventListener('message', async (ev) => {
      const buf = await toBuf(ev.data);
      chunks.push(buf);
      const all = Buffer.concat(chunks);
      /* ۲ بایتِ نخست پاسخِ VLESS است (برای Trojan چیزی اضافه نمی‌شود) */
      const body = proto === 'vless' && all.length > 2 ? all.slice(2) : all;
      const text = body.toString('utf8');
      if (/HTTP\/[\d.]+ \d{3}/.test(text)) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        const status = (text.match(/HTTP\/[\d.]+ (\d{3})/) || [])[1];
        const isReal = (status === '200' || status === '301' || status === '302') && text.length > 40;
        ok(label + '  →  پاسخ HTTP ' + status, isReal,
          isReal ? '' : text.slice(0, 120).replace(/\r?\n/g, ' '));
        resolve();
      }
    });

    ws.addEventListener('open', () => {
      if (!earlyData) {
        try { ws.send(payload); } catch (e) {
          if (!done) { done = true; clearTimeout(timer); ok(label, false, 'ارسال: ' + e.message); resolve(); }
        }
      }
    });

    ws.addEventListener('error', (ev) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ok(label, false, 'خطای سوکت: ' + ((ev && ev.message) || 'نامشخص'));
      resolve();
    });

    ws.addEventListener('close', (ev) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const all = Buffer.concat(chunks);
      ok(label, false, 'بسته شد پیش از پاسخ (کد ' + (ev && ev.code) + '، ' + all.length + ' بایت)');
      resolve();
    });
  });
}

/* اینترنت گاهی نوسان دارد؛ یک تلاشِ دوباره می‌کنیم تا «گذرا» از «واقعاً خراب»
   جدا شود. تنها در صورتی شکست ثبت می‌شود که هر دو بار ناموفق باشد. */
async function attemptTwice(opts) {
  await attempt(opts);
  if (fail === 0 || !failures.some(f => f.indexOf(opts.label) === 0)) return;
  /* تلاشِ نخست ناموفق بود: آن را پس می‌گیریم و یک بار دیگر می‌سنجیم */
  const i = failures.findIndex(f => f.indexOf(opts.label) === 0);
  if (i >= 0) failures.splice(i, 1);
  fail--;
  console.log('     ↻ تلاشِ دوباره…');
  await attempt(Object.assign({}, opts, { label: opts.label }));
}

/* ========================================================================== */
(async () => {
  console.log('\n🎯 تستِ واقعیِ سرتاسر در برابر: ' + HOST);
  console.log('   مقصدِ تونل: http://' + TARGET + '/\n');

  console.log('▸ VLESS روی پورت‌های گوناگون (TLS)');
  await attemptTwice({ label: 'VLESS  wss پورت ۴۴۳', proto: 'vless', port: 443, tls: true });
  await attemptTwice({ label: 'VLESS  wss پورت ۲۰۵۳', proto: 'vless', port: 2053, tls: true });
  await attemptTwice({ label: 'VLESS  wss پورت ۸۴۴۳', proto: 'vless', port: 8443, tls: true });

  console.log('\n▸ VLESS روی پورتِ plaintext (بدون TLS — باگِ پیشین اینجا شکست می‌خورد)');
  await attemptTwice({ label: 'VLESS  ws  پورت ۸۰', proto: 'vless', port: 80, tls: false });

  console.log('\n▸ Trojan');
  await attemptTwice({ label: 'Trojan wss پورت ۴۴۳', proto: 'trojan', port: 443, tls: true });
  await attemptTwice({ label: 'Trojan ws  پورت ۸۰', proto: 'trojan', port: 80, tls: false });

  console.log('\n▸ داده‌ی زودهنگام (early data در Sec-WebSocket-Protocol)');
  await attemptTwice({ label: 'VLESS  +early-data پورت ۴۴۳', proto: 'vless', port: 443, tls: true, earlyData: true });

  console.log('\n▸ مسیر با ?ed=2048 (همان چیزی که کانفیگ می‌فرستد)');
  await attemptTwice({ label: 'VLESS  مسیرِ کانفیگ', proto: 'vless', port: 443, tls: true, path: '/takht?ed=2048' });

  try { fs.unlinkSync(UTILS); } catch (e) {}

  console.log('\n' + '='.repeat(58));
  console.log('نتیجه: ' + pass + ' موفق · ' + fail + ' ناموفق');
  if (failures.length) { console.log('\nموارد ناموفق:'); for (const f of failures) console.log('  • ' + f); }
  console.log('='.repeat(58));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
