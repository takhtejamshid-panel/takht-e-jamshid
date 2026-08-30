/* ==========================================================================
   02_utils.js — ابزارهای عمومی
   ========================================================================== */

/* ---------- base64 / base64url ---------- */
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function b64decode(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlEncode(bytes) {
  let bin = '';
  if (typeof bytes === 'string') bytes = new TextEncoder().encode(bytes);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return b64decode(s);
}

function hexToBytes(hex) {
  if (hex.length % 2) hex = '0' + hex;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

/* ---------- رمزنگاری ---------- */
async function sha256(message, hex) {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return hex ? bytesToHex(new Uint8Array(digest)) : new Uint8Array(digest);
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

/* ---------------- SHA-224 (برای پروتکل Trojan) ----------------
   کلاینت‌های Trojan رمز را به‌صورت SHA-224ِ هگز (۵۶ کاراکتر) می‌فرستند.
   WebCrypto از SHA-224 پشتیبانی نمی‌کند، بنابراین اینجا پیاده‌سازی شده است
   (هسته‌ی SHA-256 با بردار اولیه‌ی متفاوت و خروجیِ ۲۸ بایتی).
---------------------------------------------------------------- */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const SHA224_IV = new Uint32Array([
  0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
  0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4,
]);

function rotr32(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

function sha224Bytes(input) {
  const msg = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const H = SHA224_IV.slice();
  const bitLen = msg.length * 8;
  const total = (((msg.length + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(bitLen / 4294967296), false);
  dv.setUint32(total - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(28);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 7; i++) odv.setUint32(i * 4, H[i], false);
  return out;
}

function sha224Hex(input) { return bytesToHex(sha224Bytes(input)); }

function uuidv4() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12);
}

function isUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ''));
}

function randomToken(len) {
  const b = new Uint8Array(len || 16);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

function randomHex(len) {
  const b = new Uint8Array(Math.ceil((len || 8) / 2));
  crypto.getRandomValues(b);
  return bytesToHex(b).slice(0, len);
}

/* مقایسه امن رشته‌ها (جلوگیری از timing attack) */
async function safeEqual(a, b) {
  const ha = await sha256(String(a));
  const hb = await sha256(String(b));
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

/* ---------- قالب‌بندی ---------- */
function formatBytes(bytes, decimals) {
  bytes = Number(bytes) || 0;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals === undefined ? 2 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function parseSize(str) {
  if (str === null || str === undefined) return 0;
  const s = String(str).trim().toLowerCase();
  if (!s) return 0;
  const m = s.match(/^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/);
  if (!m) return 0;
  const num = parseFloat(m[1].replace(/,/g, ''));
  const unit = m[2] || 'b';
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 }[unit];
  return Math.round(num * mult);
}

function nowMs() { return Date.now(); }
function daysToMs(d) { return Math.round(Number(d) * 86400000); }

function formatDate(ms, lang) {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  if (lang === 'en') return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  return d.getUTCFullYear() + '/' + p(d.getUTCMonth() + 1) + '/' + p(d.getUTCDate());
}

function daysLeft(ms) {
  if (!ms) return Infinity;
  return Math.ceil((ms - Date.now()) / 86400000);
}

function num(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0));
}

/* ---------- متفرقه ---------- */
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizeHost(host) {
  return String(host || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
}

function getHostFromRequest(request) {
  const u = new URL(request.url);
  const proto = u.protocol.replace(':', '');
  return { host: u.hostname, port: u.port || (proto === 'http' ? 80 : 443), proto, hostHeader: u.host };
}

function concatBytes(list) {
  let total = 0;
  for (const b of list) total += b.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of list) { out.set(b, off); off += b.length; }
  return out;
}

function splitLines(str) {
  return String(str || '').split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
}

/* شبکه: بررسی IPv4 / IPv6 / دامنه */
function isIPv4(s) { return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(String(s || '').trim()); }
function isIPv6(s) { return String(s || '').includes(':') && /^[0-9a-fA-F:.]+$/.test(String(s || '').trim()); }
function isValidHost(s) {
  s = String(s || '').trim();
  if (!s || s.length > 253) return false;
  if (isIPv4(s) || isIPv6(s)) return true;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(s);
}

/* پاسخ‌های کمکی */
function jsonResponse(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers || {}),
  });
}

function htmlResponse(html, status, headers) {
  return new Response(html, {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, headers || {}),
  });
}

function textResponse(text, status, headers) {
  return new Response(text, {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, headers || {}),
  });
}
