/* ==========================================================================
   11_scanner.js — اسکنر آی‌پی تمیز
   --------------------------------------------------------------------------
   ایده: به‌جای حدس زدن، از قابلیت resolveOverride در fetchِ کلودفلر استفاده
   می‌کنیم. برای هر آی‌پیِ کاندید، یک درخواستِ واقعی به
       https://<میزبانِ پروب>/cdn-cgi/trace
   می‌فرستیم ولی آدرسِ مقصد را به آن آی‌پی «تحمیل» می‌کنیم. پاسخِ لبه‌ی کلودفلر
   شامل colo (دیتاسنتر)، loc (کشور)، نسخه‌ی TLS و زمانِ رفت‌وبرگشت است.
   نتیجه: می‌فهمیم هر آی‌پی کدام دیتاسنتر است، زنده است یا نه، و چقدر تند است.

   محدودیتِ صادقانه: این اندازه‌گیری از «لبه‌ی کلودفلر» انجام می‌شود، نه از شبکه‌ی
   کاربرِ نهایی. پس بهترین کاربردش پیدا کردنِ دیتاسنترهای نزدیک و سالم است؛
   تشخیصِ قطعیِ فیلترینگِ یک ISP خاص فقط با تست در کلاینتِ خود کاربر ممکن است.
   ========================================================================== */

/* بازه‌های رسمیِ IPv4 کلودفلر (منبع: https://www.cloudflare.com/ips-v4) */
const CF_IPV4_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

/* --------------------------- کار با آدرس‌ها --------------------------- */

function ipToUint(ip) {
  const p = String(ip).trim().split('.');
  if (p.length !== 4) return 0;
  return ((Number(p[0]) << 24) >>> 0) + (Number(p[1]) << 16) + (Number(p[2]) << 8) + Number(p[3]);
}

function uintToIp(n) {
  n = n >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function parseCidr(cidr) {
  const m = String(cidr).trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
  if (!m) return null;
  const bits = Number(m[2]);
  if (bits < 8 || bits > 32) return null;
  const base = ipToUint(m[1]);
  const size = Math.pow(2, 32 - bits);
  return { cidr: m[1] + '/' + bits, base: (base & ~(size - 1)) >>> 0, size };
}

/* یک مولد اعداد شبه‌تصادفی سبک (xorshift32) برای نمونه‌گیریِ تکرارپذیر */
function makeRandom(seed) {
  let s = (Number(seed) || 1) >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * تولید فهرست آی‌پی‌های کاندید
 * mode = 'spread' | 'random'
 *   spread: نمونه‌ها را به‌طور متوازن بین بازه‌ها پخش می‌کند (پوشش بهتر)
 *   random: انتخاب کاملاً تصادفی (متنوع‌تر)
 */
function generateCandidates(opts) {
  const o = opts || {};
  const count = clamp(Number(o.count) || 100, 1, 2000);
  const list = (Array.isArray(o.ranges) && o.ranges.length ? o.ranges : CF_IPV4_RANGES)
    .map(parseCidr).filter(Boolean);
  if (!list.length) return [];

  const rnd = makeRandom(o.seed || (Date.now() & 0x7fffffff));
  const out = [];
  const seen = Object.create(null);

  const push = (ip) => {
    if (seen[ip]) return;
    seen[ip] = 1;
    out.push(ip);
  };

  if (o.mode === 'random') {
    // وزن‌دهی بر اساس اندازه‌ی هر بازه
    const total = list.reduce((a, r) => a + r.size, 0);
    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      let x = Math.floor(rnd() * total);
      let picked = list[list.length - 1];
      for (const r of list) { if (x < r.size) { picked = r; break; } x -= r.size; }
      push(uintToIp((picked.base + Math.floor(rnd() * picked.size)) >>> 0));
    }
  } else {
    // پخش متوازن: از هر بازه به نسبتِ اندازه سهم می‌گیریم
    const total = list.reduce((a, r) => a + r.size, 0);
    for (const r of list) {
      const share = Math.max(1, Math.round(count * (r.size / total)));
      for (let i = 0; i < share && out.length < count; i++) {
        // گامِ ثابت + کمی جابه‌جایی تصادفی ⇒ پراکندگی یکنواخت
        const step = Math.floor(r.size / share);
        const offset = (i * step + Math.floor(rnd() * Math.max(1, step))) % r.size;
        push(uintToIp((r.base + offset) >>> 0));
      }
    }
    // اگر هنوز کم داریم (گرد کردن)، تصادفی پر کن
    let guard = 0;
    while (out.length < count && guard < count * 20) {
      guard++;
      const r = list[Math.floor(rnd() * list.length)];
      push(uintToIp((r.base + Math.floor(rnd() * r.size)) >>> 0));
    }
  }
  return out.slice(0, count);
}

/* ------------------------------- اندازه‌گیری ------------------------------- */

function parseTrace(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

async function timedFetch(url, init, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) { /* */ } }, ms);
  try {
    return await fetch(url, Object.assign({}, init, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * اندازه‌گیری یک آی‌پی
 * @returns {{ip:string, ok:boolean, ms:number, colo:string, loc:string, http:string, error:string}}
 */
async function probeIP(env, settings, ip, timeoutMs, probeHost) {
  const ms = clamp(Number(timeoutMs) || (settings.scanTimeout || 2500), 500, 10000);
  const host = String(probeHost || settings.scanProbeHost || '').trim() || 'cloudflare.com';
  const url = 'https://' + host + '/cdn-cgi/trace';
  const started = Date.now();

  const result = { ip, ok: false, ms: 0, colo: '', loc: '', http: '', tls: '', error: '' };
  let res = null;
  try {
    res = await timedFetch(url, {
      method: 'GET',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Takht-e-Jamshid-Scanner/' + VERSION + ')' },
      cf: { resolveOverride: ip },
      redirect: 'follow',
    }, ms);
  } catch (e) {
    result.ms = Date.now() - started;
    result.error = 'timeout';
    return result;
  }

  result.ms = Date.now() - started;
  if (!res.ok) {
    result.error = 'http-' + res.status;
    return result;
  }
  let text = '';
  try { text = await res.text(); } catch (e) { result.error = 'read'; return result; }

  const tr = parseTrace(text);
  result.colo = tr.colo || '';
  result.loc = tr.loc || '';
  result.http = tr.http || '';
  result.tls = tr.tls || '';
  // اگر پاسخ معتبر نبود (مثلاً صفحه‌ای دیگر برگشته)، ناموفق حساب کن
  result.ok = !!result.colo;
  if (!result.ok) result.error = 'no-trace';
  return result;
}

/** اجرای دسته‌ای با محدودیتِ هم‌زمانی */
async function probeBatch(env, settings, ips, opts) {
  const o = opts || {};
  const concurrency = clamp(Number(o.concurrency) || (settings.scanConcurrency || 8), 1, 20);
  const timeoutMs = Number(o.timeout) || settings.scanTimeout || 2500;
  const probeHost = o.probeHost || settings.scanProbeHost || '';
  const list = (Array.isArray(ips) ? ips : []).filter(isIPv4).slice(0, 20);

  const results = new Array(list.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= list.length) return;
      try {
        results[i] = await probeIP(env, settings, list[i], timeoutMs, probeHost);
      } catch (e) {
        results[i] = { ip: list[i], ok: false, ms: 0, colo: '', loc: '', http: '', tls: '', error: 'error' };
      }
    }
  };

  const pool = [];
  for (let i = 0; i < Math.min(concurrency, list.length); i++) pool.push(worker());
  await Promise.all(pool);
  return results.filter(Boolean);
}

/* ------------------------------ ذخیره‌ی نتایج ------------------------------ */

async function saveScanResults(env, results) {
  const d = env && env.DB ? env.DB : null;
  if (!d) return 0;
  await dbInit(env);
  const now = nowMs();
  const seen = Object.create(null);
  const stmts = [];
  for (const r of results) {
    if (!r || !r.ip || seen[r.ip]) continue;
    seen[r.ip] = 1;
    stmts.push(d.prepare(
      'INSERT INTO scan_cache (ip, colo, loc, latency, ok, http, tls, ts) VALUES (?,?,?,?,?,?,?,?) '
      + 'ON CONFLICT(ip) DO UPDATE SET colo=excluded.colo, loc=excluded.loc, latency=excluded.latency, '
      + 'ok=excluded.ok, http=excluded.http, tls=excluded.tls, ts=excluded.ts'
    ).bind(r.ip, r.colo || '', r.loc || '', Number(r.ms) || 0, r.ok ? 1 : 0,
           r.http || '', r.tls || '', now));
    if (stmts.length >= 40) { await d.batch(stmts); stmts.length = 0; }
  }
  if (stmts.length) await d.batch(stmts);
  return Object.keys(seen).length;
}

async function getScanCache(env, limit) {
  const d = env && env.DB ? env.DB : null;
  if (!d) return [];
  await dbInit(env);
  const res = await d.prepare('SELECT * FROM scan_cache ORDER BY ts DESC LIMIT ?')
    .bind(clamp(limit || 300, 1, 2000)).all();
  return (res.results || []).map(r => ({
    ip: r.ip, colo: r.colo || '', loc: r.loc || '',
    latency: Number(r.latency) || 0, ok: Number(r.ok) === 1,
    http: r.http || '', tls: r.tls || '', ts: Number(r.ts) || 0,
  }));
}

async function clearScanCache(env) {
  const d = env && env.DB ? env.DB : null;
  if (!d) return false;
  await dbInit(env);
  await d.prepare('DELETE FROM scan_cache').run();
  return true;
}

/** ساخت برچسبِ خوانا برای هر آی‌پی: «COLO · کشور» */
function ipLabel(item) {
  const parts = [];
  if (item.colo) parts.push(item.colo);
  if (item.loc) parts.push(item.loc);
  return parts.length ? parts.join('-') : (item.ip || '');
}
