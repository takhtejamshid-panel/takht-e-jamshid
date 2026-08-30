/* =============================================================================
 *  تخت جمشید | TAKHT-E JAMSHID — پنل لبه‌ای پارسه
 *  نسخه 0.2.2
 *
 *  این فایل به‌صورت خودکار از پوشه‌ی src ساخته شده است؛ خودِ آن را ویرایش نکنید.
 *  جهت توسعه: فایل‌های src/ را تغییر دهید و `node build.js` را اجرا کنید.
 *
 *  پیش‌نیازها:
 *    • یک Worker روی Cloudflare (پلن رایگان کافی است)
 *    • یک دیتابیس D1 با اتصال (Binding) به نام دقیقِ DB
 *
 *  آدرس پنل:  https://<worker>.workers.dev/<route>/dash
 *  ورود پیش‌فرض: admin / admin
 * ============================================================================= */
/* ---------- 01_meta.js ------------------------------------------------ */
import { connect } from 'cloudflare:sockets';

/* ==========================================================================
   تخت جمشید | TAKHT-E JAMSHID  —  Persepolis Edge Panel
   یک پنل مدیریت پروکسی لبه‌ای روی Cloudflare Workers
   نسخه ۰.۱.۰  ·  مجوز MIT
   --------------------------------------------------------------------------
   ساختار فایل:
     01_meta.js        ثابت‌ها، تنظیمات پیش‌فرض، واژگان دو‌زبانه
     02_utils.js       ابزارها: رمزنگاری، base64، uuid، قالب‌بندی
     03_db.js          لایه دسترسی به D1 (تنظیمات، کاربران، لاگ)
     04_config.js      تولید کانفیگ: VLESS / Trojan / Clash / Sing-box
     05_qr.js          تولیدکننده QR Code (بدون وابستگی خارجی)
     06_telegram.js    ربات تلگرام
     07_proxy.js       هسته پروکسی: VLESS و Trojan روی WebSocket
     08_ui.js          رابط کاربری پنل (تم تخت جمشید)
     09_api.js         API پنل
     10_main.js        مسیریاب اصلی و نقطه ورود
   ========================================================================== */

const VERSION = '0.2.2';
const PANEL_FA = 'تخت جمشید';
const PANEL_EN = 'Takht-e Jamshid';
const PANEL_TAG = 'پنل لبه‌ای پارسه';

/* -------------------------------------------------------------------------
   تنظیمات پیش‌فرض
   ------------------------------------------------------------------------- */
const DEFAULT_SETTINGS = {
  // مسیر پایه مخفی — همه چیز زیر این مسیر است
  route: 'takht',

  // احراز هویت پنل
  panelUser: 'dariush',
  panelPassHash: '',      // در اولین اجرا با sha256('admin') پر می‌شود
  passSalt: '',

  // پروتکل: vless | trojan | both
  protocol: 'both',

  // استتار: static | proxy | redirect
  disguiseMode: 'static',
  disguiseUrl: 'https://en.wikipedia.org/wiki/Persepolis',

  // میزبان پیش‌فرض کانفیگ‌ها (خالی = همان میزبان درخواست)
  host: '',
  ports: [443, 80, 2053, 2083, 2087, 2096, 8443],
  tls: true,
  allowInsecure: false,
  ech: true,
  sni: '',

  // لیست IP تمیز: [{ip:'1.1.1.1', name:'Germany'}]
  cleanIPs: [],

  // خروجی: direct | proxyip | socks5
  outMode: 'direct',
  proxyIP: '',            // host:port — یک سرور VLESS/Trojan مقصد
  socks5: '',             // user:pass@host:port
  socks5All: false,

  // کاربران
  multiUser: true,
  autoDisable: true,
  startOnFirstUse: false,

  // قالب‌بندی
  naming: '{FLAG} {CITY} · {NUM}',
  nodePrefix: PANEL_FA,

  // کلید قطع اضطراری
  killSwitch: false,

  // تلگرام
  tgToken: '',
  tgChatId: '',
  tgEnabled: false,
  tgNotifyLogin: true,

  // رابط
  lang: 'fa',
  theme: 'persepolis',

  // شبکه
  udp: true,
  blockAds: false,
  blockPorn: false,
  doh: 'https://cloudflare-dns.com/dns-query',

  // فرگمنت (عبور از DPI)
  fragment: { enabled: false, length: 100, interval: 10 },

  // اسکنر آی‌پی تمیز
  scanProbeHost: '',        // خالی = خودکار (میزبان پنل، سپس cloudflare.com)
  scanTimeout: 2500,        // مهلت هر اندازه‌گیری (میلی‌ثانیه)
  scanConcurrency: 8,       // تعداد اندازه‌گیری هم‌زمان

  // محدودیت‌ها
  subFormats: ['auto', 'base64', 'clash', 'singbox'],
};

/* -------------------------------------------------------------------------
   واژگان دو‌زبانه رابط کاربری
   ------------------------------------------------------------------------- */
const I18N = {
  fa: {
    login: 'ورود به تخت جمشید',
    username: 'نام کاربری',
    password: 'گذرواژه',
    enter: 'ورود',
    overview: 'نمای کلی',
    users: 'کاربران',
    endpoints: 'نقاط اتصال',
    settings: 'تنظیمات',
    network: 'شبکه',
    telegram: 'تلگرام',
    logs: 'گزارش‌ها',
    backup: 'پشتیبان',
    help: 'راهنما',
    logout: 'خروج',
    totalUsers: 'کل کاربران',
    activeUsers: 'کاربران فعال',
    traffic: 'ترافیک مصرفی',
    quota: 'سهمیه کل',
    status: 'وضعیت',
    online: 'در دسترس',
    offline: 'متوقف',
    name: 'نام',
    usage: 'مصرف',
    expiry: 'انقضا',
    devices: 'دستگاه',
    actions: 'عملیات',
    addUser: 'افزودن کاربر',
    edit: 'ویرایش',
    remove: 'حذف',
    reset: 'صفر کردن مصرف',
    enable: 'فعال',
    disable: 'غیرفعال',
    copy: 'کپی',
    copied: 'کپی شد',
    save: 'ذخیره تغییرات',
    saving: 'در حال ذخیره…',
    saved: 'ذخیره شد',
    cancel: 'انصراف',
    confirm: 'تأیید',
    search: 'جستجو…',
    unlimited: 'نامحدود',
    expired: 'منقضی',
    days: 'روز',
    subscription: 'اشتراک',
    qrcode: 'کد QR',
    configLink: 'لینک کانفیگ',
    format: 'قالب',
    trafficUsed: 'مصرف‌شده',
    trafficLeft: 'باقیمانده',
    neverExpires: 'بدون تاریخ',
    killSwitch: 'کلید قطع اضطراری',
    killSwitchHelp: 'با فعال کردن، تمام ترافیک پروکسی بلافاصله متوقف می‌شود.',
    cleanIP: 'آی‌پی تمیز',
    cleanIPHelp: 'هر آی‌پی در یک خط. فرمت: 1.1.1.1#آلمان',
    protocol: 'پروتکل',
    route: 'مسیر مخفی',
    routeHelp: 'مسیر پایه پنل و پروکسی. بعد از تغییر باید آن را نشانک کنید.',
    save_warn: 'بعد از تغییر مسیر، آدرس پنل عوض می‌شود.',
    yes: 'بله',
    no: 'خیر',
    export: 'خروجی گرفتن',
    import: 'بازیابی',
    danger: 'ناحیه خطر',
    account: 'حساب',
    logoutTitle: 'خروج از پنل',
    scanner: 'اسکنر آی‌پی',
    scanStart: 'شروع اسکن',
    scanStop: 'توقف',
    scanCandidates: 'تعداد کاندیدا',
    scanMode: 'روش نمونه‌گیری',
    scanBalanced: 'متوازن (پوشش بهتر)',
    scanRandom: 'تصادفی',
    scanTimeout: 'مهلت هر تست (میلی‌ثانیه)',
    scanHost: 'میزبانِ پروب',
    scanConcurrency: 'تعداد هم‌زمان',
    scanDatacenter: 'دیتاسنتر',
    scanLatency: 'تأخیر',
    scanApply: 'اعمال روی کانفیگ‌ها',
    scanClear: 'پاک‌سازی نتایج',
    scanLoaded: 'بارگیری نتایج ذخیره‌شده',
  },
  en: {
    login: 'Sign in to Takht-e Jamshid',
    username: 'Username',
    password: 'Password',
    enter: 'Enter',
    overview: 'Overview',
    users: 'Users',
    endpoints: 'Endpoints',
    settings: 'Settings',
    network: 'Network',
    telegram: 'Telegram',
    logs: 'Logs',
    backup: 'Backup',
    help: 'Help',
    logout: 'Log out',
    totalUsers: 'Total users',
    activeUsers: 'Active users',
    traffic: 'Traffic used',
    quota: 'Total quota',
    status: 'Status',
    online: 'Online',
    offline: 'Stopped',
    name: 'Name',
    usage: 'Usage',
    expiry: 'Expiry',
    devices: 'Devices',
    actions: 'Actions',
    addUser: 'Add user',
    edit: 'Edit',
    remove: 'Delete',
    reset: 'Reset usage',
    enable: 'Enable',
    disable: 'Disable',
    copy: 'Copy',
    copied: 'Copied',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    confirm: 'Confirm',
    search: 'Search…',
    unlimited: 'Unlimited',
    expired: 'Expired',
    days: 'days',
    subscription: 'Subscription',
    qrcode: 'QR code',
    configLink: 'Config link',
    format: 'Format',
    trafficUsed: 'Used',
    trafficLeft: 'Left',
    neverExpires: 'Never',
    killSwitch: 'Emergency kill switch',
    killSwitchHelp: 'When enabled, all proxy traffic stops immediately.',
    cleanIP: 'Clean IP',
    cleanIPHelp: 'One per line. Format: 1.1.1.1#Germany',
    protocol: 'Protocol',
    route: 'Secret route',
    routeHelp: 'Base path for panel and proxy. Bookmark it after changing.',
    save_warn: 'The panel address changes after you rename the route.',
    yes: 'Yes',
    no: 'No',
    export: 'Export',
    import: 'Restore',
    danger: 'Danger zone',
    account: 'Account',
    logoutTitle: 'Sign out',
  },
};

function t(key, lang) {
  const dict = I18N[lang] || I18N.fa;
  return dict[key] !== undefined ? dict[key] : (I18N.fa[key] !== undefined ? I18N.fa[key] : key);
}

/* پرچم‌ها برای قالب نام‌گذاری نودها */
const FLAGS = {
  'DE': '🇩🇪', 'NL': '🇳🇱', 'FR': '🇫🇷', 'GB': '🇬🇧', 'US': '🇺🇸', 'CA': '🇨🇦',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'FI': '🇫🇮', 'CH': '🇨🇭', 'AT': '🇦🇹', 'IT': '🇮🇹',
  'ES': '🇪🇸', 'TR': '🇹🇷', 'AE': '🇦🇪', 'JP': '🇯🇵', 'SG': '🇸🇬', 'IN': '🇮🇳',
  'AU': '🇦🇺', 'BR': '🇧🇷', 'PL': '🇵🇱', 'CZ': '🇨🇿', 'IR': '🇮🇷', 'AM': '🇦🇲',
};

/* ---------- 02_utils.js ----------------------------------------------- */
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

/* ---------- 03_db.js -------------------------------------------------- */
/* ==========================================================================
   03_db.js — لایه دسترسی به Cloudflare D1
   نام اتصال (Binding) باید دقیقاً DB باشد.
   ========================================================================== */

const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  data        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  uuid          TEXT NOT NULL UNIQUE,
  trojan_pass   TEXT,
  token         TEXT NOT NULL UNIQUE,
  quota_bytes   INTEGER NOT NULL DEFAULT 0,
  used_bytes    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  expire_at     INTEGER NOT NULL DEFAULT 0,
  device_limit  INTEGER NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  note          TEXT DEFAULT '',
  last_seen     INTEGER NOT NULL DEFAULT 0,
  first_use     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_users_uuid  ON users(uuid);

CREATE TABLE IF NOT EXISTS scan_cache (
  ip       TEXT PRIMARY KEY,
  colo     TEXT DEFAULT '',
  loc      TEXT DEFAULT '',
  latency  INTEGER NOT NULL DEFAULT 0,
  ok       INTEGER NOT NULL DEFAULT 0,
  http     TEXT DEFAULT '',
  tls      TEXT DEFAULT '',
  ts       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scan_ok ON scan_cache(ok, latency);

CREATE TABLE IF NOT EXISTS logs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  level    TEXT NOT NULL,
  actor    TEXT DEFAULT '',
  message  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
`;

/* حافظه میان‌درخواستی در سطح isolate */
const _cache = {
  settings: null,
  settingsAt: 0,
  schemaReady: false,
  usageBuffer: {},
  usageCount: 0,
  lastFlush: 0,
  conns: {},
  trojanMap: null,     /* نگاشتِ sha224(رمز) → شناسه کاربر، برای جستجوی سریع Trojan */
};

const SETTINGS_TTL = 5000;      // ۵ ثانیه کش تنظیمات
const FLUSH_INTERVAL = 20000;   // هر ۲۰ ثانیه یکبار نوشتن مصرف
const FLUSH_THRESHOLD = 64;     // یا وقتی ۶۴ رکورد جمع شد

function db(env) {
  return env && env.DB ? env.DB : null;
}

async function dbInit(env) {
  if (_cache.schemaReady) return true;
  const d = db(env);
  if (!d) return false;
  try {
    await d.prepare(DB_SCHEMA).run();
    _cache.schemaReady = true;
    return true;
  } catch (e) {
    console.error('schema error:', e && e.message);
    return false;
  }
}

/* ------------------------------- تنظیمات ------------------------------- */

async function getSettings(env) {
  const now = nowMs();
  if (_cache.settings && now - _cache.settingsAt < SETTINGS_TTL) return _cache.settings;
  const d = db(env);
  if (!d) return Object.assign({}, DEFAULT_SETTINGS);
  await dbInit(env);
  try {
    const row = await d.prepare('SELECT data FROM settings WHERE id = 1').first();
    if (row && row.data) {
      const parsed = safeJsonParse(row.data, {});
      const merged = Object.assign({}, DEFAULT_SETTINGS, parsed);
      merged.fragment = Object.assign({}, DEFAULT_SETTINGS.fragment, parsed.fragment || {});
      merged.cleanIPs = Array.isArray(parsed.cleanIPs) ? parsed.cleanIPs : [];
      _cache.settings = merged;
      _cache.settingsAt = now;
      return merged;
    }
  } catch (e) { /* جدول هنوز نساخته شده */ }

  // نخستین اجرا: تنظیمات پیش‌فرض را ذخیره کن
  const fresh = Object.assign({}, DEFAULT_SETTINGS);
  fresh.passSalt = randomToken(8);
  /* اگر متغیر محیطیِ PANEL_PASS تنظیم شده باشد (مثلاً توسط باتِ نصاب)،
     به‌جای گذرواژه‌ی پیش‌فرضِ «admin» همان به‌عنوان گذرواژه‌ی آغازین به‌کار می‌رود. */
  const bootPass = String((env && env.PANEL_PASS) || '').trim() || 'admin';
  fresh.panelPassHash = await sha256(bootPass + fresh.passSalt, true);
  try {
    await d.prepare(
      'INSERT OR REPLACE INTO settings (id, data, updated_at) VALUES (1, ?, ?)'
    ).bind(JSON.stringify(fresh), now).run();
  } catch (e) { /* در صورت نبود دیتابیس، فقط در حافظه نگه می‌داریم */ }
  _cache.settings = fresh;
  _cache.settingsAt = now;
  return fresh;
}

async function saveSettings(env, settings) {
  const d = db(env);
  const data = JSON.stringify(settings);
  _cache.settings = settings;
  _cache.settingsAt = nowMs();
  if (!d) return false;
  await dbInit(env);
  await d.prepare('INSERT OR REPLACE INTO settings (id, data, updated_at) VALUES (1, ?, ?)')
    .bind(data, nowMs()).run();
  return true;
}

/* ------------------------------- کاربران ------------------------------- */

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    uuid: row.uuid,
    trojanPass: row.trojan_pass || '',
    token: row.token,
    quota: Number(row.quota_bytes) || 0,
    used: Number(row.used_bytes) || 0,
    createdAt: Number(row.created_at) || 0,
    expireAt: Number(row.expire_at) || 0,
    deviceLimit: Number(row.device_limit) || 0,
    enabled: Number(row.enabled) === 1,
    note: row.note || '',
    lastSeen: Number(row.last_seen) || 0,
    firstUse: Number(row.first_use) || 0,
  };
}

async function listUsers(env) {
  const d = db(env);
  if (!d) return [];
  await dbInit(env);
  const res = await d.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return (res.results || []).map(normalizeUser);
}

async function getUserById(env, id) {
  const d = db(env);
  if (!d) return null;
  await dbInit(env);
  const row = await d.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return normalizeUser(row);
}

async function getUserByToken(env, token) {
  const d = db(env);
  if (!d) return null;
  await dbInit(env);
  const row = await d.prepare('SELECT * FROM users WHERE token = ?').bind(token).first();
  return normalizeUser(row);
}

async function getUserByUuid(env, uuid) {
  const d = db(env);
  if (!d) return null;
  await dbInit(env);
  const row = await d.prepare('SELECT * FROM users WHERE uuid = ? OR trojan_pass = ?')
    .bind(uuid, uuid).first();
  return normalizeUser(row);
}

/** یافتن کاربر از رویِ SHA-224ِ رمز Trojan (همان چیزی که کلاینت می‌فرستد) */
async function getUserByTrojan(env, hexPassword) {
  if (!hexPassword || hexPassword.length !== 56) return null;
  if (!_cache.trojanMap) {
    const users = await listUsers(env);
    const map = {};
    for (const u of users) {
      if (!u.trojanPass) continue;
      map[sha224Hex(u.trojanPass)] = u.id;
    }
    _cache.trojanMap = map;
  }
  const id = _cache.trojanMap[hexPassword];
  return id ? await getUserById(env, id) : null;
}

async function createUser(env, input) {
  const d = db(env);
  if (!d) throw new Error('DB_MISSING');
  await dbInit(env);
  const id = randomToken(12);
  const u = {
    id,
    name: String(input.name || 'user').trim().slice(0, 64),
    uuid: isUUID(input.uuid) ? input.uuid : uuidv4(),
    trojanPass: input.trojanPass || randomToken(8),
    token: randomToken(12),
    quotaBytes: parseSize(input.quota) || 0,
    usedBytes: 0,
    createdAt: nowMs(),
    expireAt: input.expireDays ? nowMs() + daysToMs(input.expireDays) : (Number(input.expireAt) || 0),
    deviceLimit: Number(input.deviceLimit) || 0,
    enabled: input.enabled === false ? 0 : 1,
    note: String(input.note || '').slice(0, 500),
    lastSeen: 0,
    firstUse: 0,
  };
  await d.prepare(
    'INSERT INTO users (id,name,uuid,trojan_pass,token,quota_bytes,used_bytes,created_at,expire_at,device_limit,enabled,note,last_seen,first_use) '
    + 'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    u.id, u.name, u.uuid, u.trojanPass, u.token, u.quotaBytes, u.usedBytes,
    u.createdAt, u.expireAt, u.deviceLimit, u.enabled, u.note, u.lastSeen, u.firstUse
  ).run();
  _cache.trojanMap = null;
  return getUserById(env, id);
}

async function updateUser(env, id, patch) {
  const d = db(env);
  if (!d) throw new Error('DB_MISSING');
  await dbInit(env);
  const cur = await getUserById(env, id);
  if (!cur) return null;
  const next = {
    name: patch.name !== undefined ? String(patch.name).trim().slice(0, 64) : cur.name,
    uuid: patch.uuid !== undefined ? (isUUID(patch.uuid) ? patch.uuid : cur.uuid) : cur.uuid,
    trojanPass: patch.trojanPass !== undefined ? String(patch.trojanPass) : cur.trojanPass,
    quota: patch.quota !== undefined ? parseSize(patch.quota) : (patch.quotaBytes !== undefined ? Number(patch.quotaBytes) : cur.quota),
    used: patch.used !== undefined ? parseSize(patch.used) : (patch.usedBytes !== undefined ? Number(patch.usedBytes) : cur.used),
    expireAt: patch.expireAt !== undefined ? Number(patch.expireAt)
      : (patch.expireDays !== undefined ? (Number(patch.expireDays) > 0 ? nowMs() + daysToMs(patch.expireDays) : 0) : cur.expireAt),
    deviceLimit: patch.deviceLimit !== undefined ? Number(patch.deviceLimit) : cur.deviceLimit,
    enabled: patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : (cur.enabled ? 1 : 0),
    note: patch.note !== undefined ? String(patch.note).slice(0, 500) : cur.note,
    token: patch.token !== undefined ? String(patch.token) : cur.token,
  };
  await d.prepare(
    'UPDATE users SET name=?, uuid=?, trojan_pass=?, token=?, quota_bytes=?, used_bytes=?, '
    + 'expire_at=?, device_limit=?, enabled=?, note=? WHERE id=?'
  ).bind(
    next.name, next.uuid, next.trojanPass, next.token, next.quota, next.used,
    next.expireAt, next.deviceLimit, next.enabled, next.note, id
  ).run();
  _cache.settingsAt = 0;
  _cache.trojanMap = null;
  return getUserById(env, id);
}

async function deleteUser(env, id) {
  const d = db(env);
  if (!d) throw new Error('DB_MISSING');
  await dbInit(env);
  await d.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  _cache.trojanMap = null;
  return true;
}

async function touchUser(env, id, ip) {
  const d = db(env);
  if (!d) return;
  try {
    await d.prepare('UPDATE users SET last_seen = ?, first_use = CASE WHEN first_use = 0 THEN ? ELSE first_use END WHERE id = ?')
      .bind(nowMs(), nowMs(), id).run();
  } catch (e) { /* غیربحرانی */ }
}

/* --------------------- شمارش مصرف (دسته‌ای و غیرهمزمان) --------------------- */

function bufferUsage(userId, bytes) {
  if (!userId || !bytes) return;
  _cache.usageBuffer[userId] = (_cache.usageBuffer[userId] || 0) + bytes;
  _cache.usageCount++;
}

async function flushUsage(env, force) {
  const d = db(env);
  const keys = Object.keys(_cache.usageBuffer);
  if (!keys.length) return 0;
  const now = nowMs();
  if (!force && _cache.usageCount < FLUSH_THRESHOLD && now - _cache.lastFlush < FLUSH_INTERVAL) return 0;

  const snapshot = _cache.usageBuffer;
  _cache.usageBuffer = {};
  _cache.usageCount = 0;
  _cache.lastFlush = now;
  if (!d) return 0;

  try {
    const stmts = keys.map(k => d.prepare('UPDATE users SET used_bytes = used_bytes + ? WHERE id = ?').bind(snapshot[k], k));
    await d.batch(stmts);
    return keys.length;
  } catch (e) {
    // برگرداندن به بافر در صورت خطا
    for (const k of keys) _cache.usageBuffer[k] = (_cache.usageBuffer[k] || 0) + snapshot[k];
    return 0;
  }
}

/* -------------------------------- لاگ‌ها -------------------------------- */

async function addLog(env, level, message, actor) {
  const d = db(env);
  if (!d) return;
  try {
    await dbInit(env);
    await d.prepare('INSERT INTO logs (ts, level, actor, message) VALUES (?,?,?,?)')
      .bind(nowMs(), level, String(actor || ''), String(message).slice(0, 1000)).run();
  } catch (e) { /* غیربحرانی */ }
}

async function listLogs(env, limit) {
  const d = db(env);
  if (!d) return [];
  await dbInit(env);
  const res = await d.prepare('SELECT * FROM logs ORDER BY ts DESC LIMIT ?').bind(clamp(limit || 200, 1, 1000)).all();
  return res.results || [];
}

async function clearLogs(env) {
  const d = db(env);
  if (!d) return;
  await d.prepare('DELETE FROM logs').run();
}

/* --------------------------- پشتیبان و بازیابی --------------------------- */

async function exportBackup(env) {
  const settings = await getSettings(env);
  const users = await listUsers(env);
  return {
    app: 'takht-e-jamshid',
    version: VERSION,
    exportedAt: nowMs(),
    settings,
    users,
  };
}

async function importBackup(env, payload) {
  if (!payload || payload.app !== 'takht-e-jamshid') throw new Error('فایل پشتیبان معتبر نیست');
  const d = db(env);
  if (!d) throw new Error('DB_MISSING');
  await dbInit(env);
  if (payload.settings) {
    const current = await getSettings(env);
    const incoming = Object.assign({}, DEFAULT_SETTINGS, payload.settings);
    // هرگز اجازه نمی‌دهیم بازیابی، مالک را از پنل قفل کند
    if (!payload.settings.panelPassHash) {
      incoming.panelPassHash = current.panelPassHash;
      incoming.passSalt = current.passSalt;
    }
    if (!payload.settings.route) incoming.route = current.route;
    await saveSettings(env, incoming);
  }
  _cache.trojanMap = null;
  if (Array.isArray(payload.users)) {
    await d.prepare('DELETE FROM users').run();
    for (const u of payload.users) {
      await d.prepare(
        'INSERT OR REPLACE INTO users (id,name,uuid,trojan_pass,token,quota_bytes,used_bytes,created_at,expire_at,device_limit,enabled,note,last_seen,first_use) '
        + 'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(
        u.id || randomToken(12), u.name || 'user', u.uuid || uuidv4(), u.trojanPass || randomToken(8),
        u.token || randomToken(12), Number(u.quota) || 0, Number(u.used) || 0,
        Number(u.createdAt) || nowMs(), Number(u.expireAt) || 0, Number(u.deviceLimit) || 0,
        u.enabled === false ? 0 : 1, String(u.note || ''), Number(u.lastSeen) || 0, Number(u.firstUse) || 0
      ).run();
    }
  }
  return true;
}

/* ---------- 04_config.js ---------------------------------------------- */
/* ==========================================================================
   04_config.js — تولید کانفیگ برای کلاینت‌های مختلف
   VLESS · Trojan · Clash · Sing-box · Base64
   ========================================================================== */

/* قالب نام نود: متغیرهای {NAME} {PROTO} {HOST} {IP} {CITY} {FLAG} {NUM} {DATE} */
function applyNaming(template, ctx) {
  let out = String(template || '{FLAG} {CITY} · {NUM}');
  const map = {
    '{NAME}': ctx.name || '',
    '{PROTO}': ctx.proto || '',
    '{HOST}': ctx.host || '',
    '{IP}': ctx.ip || ctx.host || '',
    '{CITY}': ctx.city || '',
    '{COUNTRY}': ctx.country || ctx.city || '',
    '{FLAG}': ctx.flag || '🏛️',
    '{NUM}': String(ctx.num === undefined ? 1 : ctx.num),
    '{DATE}': formatDate(Date.now(), 'fa'),
    '{USER}': ctx.name || '',
  };
  for (const k of Object.keys(map)) out = out.split(k).join(map[k]);
  return out.replace(/\s+/g, ' ').trim();
}

/* پارس کردن یک خط IP تمیز: "1.1.1.1#آلمان" یا "1.1.1.1" */
function parseCleanIPs(list) {
  const arr = Array.isArray(list) ? list : splitLines(list);
  return arr.map((item, i) => {
    if (typeof item === 'object' && item) return { ip: item.ip, name: item.name || item.ip, country: item.country || '' };
    const s = String(item).trim();
    const hash = s.indexOf('#');
    if (hash > -1) {
      const meta = s.slice(hash + 1).trim();
      const parts = meta.split(/[,\-–]/).map(x => x.trim()).filter(Boolean);
      return {
        ip: s.slice(0, hash).trim(),
        name: parts[parts.length - 1] || meta,
        country: parts[0] || '',
      };
    }
    return { ip: s, name: s, country: '' };
  }).filter(x => isValidHost(x.ip));
}

function flagOf(country) {
  if (!country) return '🏛️';
  const c = String(country).trim();
  if (FLAGS[c]) return FLAGS[c];
  // تلاش برای نام کشور انگلیسی
  const lower = c.toLowerCase();
  const found = Object.keys(FLAGS).find(k => k.toLowerCase() === lower);
  return found ? FLAGS[found] : '🏛️';
}

/* پورت‌هایی که کلادفلر روی آن‌ها فقط HTTPِ ساده می‌دهد (بدون TLS).
   فرستادنِ دست‌تکانیِ TLS روی این پورت‌ها شکستِ کاملِ اتصال است —
   کلاینت «کانفیگ کار نمی‌کند» می‌بیند، بی‌آنکه علت روشن باشد.

   منبع: مستنداتِ کلادفلر (Network ports compatible with Cloudflare's proxy)
     HTTP  : 80, 8080, 8880, 2052, 2082, 2086, 2095
     HTTPS : 443, 2053, 2083, 2087, 2096, 8443
*/
const CF_PLAIN_PORTS = [80, 8080, 8880, 2052, 2082, 2086, 2095];

/* آیا این پورت توانِ TLS دارد؟ پورت‌های ناشناس را به انتخابِ کاربر می‌سپاریم. */
function portSupportsTls(port) {
  return CF_PLAIN_PORTS.indexOf(Number(port)) < 0;
}

function buildPath(settings, userId) {
  const base = '/' + String(settings.route || 'takht').replace(/^\/+|\/+$/g, '');
  const suffix = userId ? '/' + encodeURIComponent(userId) : '';
  return base + suffix + '?ed=2048';
}

/* ساخت لینک VLESS */
function buildVlessLink(opts) {
  const o = opts || {};
  const q = [];
  q.push('encryption=none');
  q.push('security=' + (o.tls ? 'tls' : 'none'));
  if (o.tls) {
    if (o.sni) q.push('sni=' + encodeURIComponent(o.sni));
    q.push('fp=randomized');
    q.push('alpn=' + encodeURIComponent('http/1.1'));
    if (o.allowInsecure) q.push('allowInsecure=1');
  }
  q.push('type=ws');
  if (o.hostHeader) q.push('host=' + encodeURIComponent(o.hostHeader));
  q.push('path=' + encodeURIComponent(o.path || '/'));
  if (o.fragment) q.push('fragment=' + o.fragment);
  const name = encodeURIComponent(o.name || PANEL_FA);
  return 'vless://' + o.uuid + '@' + o.address + ':' + o.port + '?' + q.join('&') + '#' + name;
}

/* ساخت لینک Trojan */
function buildTrojanLink(opts) {
  const o = opts || {};
  const q = [];
  q.push('security=' + (o.tls ? 'tls' : 'none'));
  if (o.tls) {
    if (o.sni) q.push('sni=' + encodeURIComponent(o.sni));
    q.push('fp=randomized');
    q.push('alpn=' + encodeURIComponent('http/1.1'));
    if (o.allowInsecure) q.push('allowInsecure=1');
  }
  q.push('type=ws');
  if (o.hostHeader) q.push('host=' + encodeURIComponent(o.hostHeader));
  q.push('path=' + encodeURIComponent(o.path || '/'));
  const name = encodeURIComponent(o.name || PANEL_FA);
  return 'trojan://' + encodeURIComponent(o.password) + '@' + o.address + ':' + o.port + '?' + q.join('&') + '#' + name;
}

/* لیست نودها برای یک کاربر */
function buildNodesForUser(user, settings, hostInfo) {
  const nodes = [];
  const protos = settings.protocol === 'both' ? ['vless', 'trojan'] : [settings.protocol];
  const ports = Array.isArray(settings.ports) && settings.ports.length ? settings.ports : [443];
  const cleanIPs = parseCleanIPs(settings.cleanIPs);
  const baseHost = normalizeHost(settings.host) || hostInfo.host;
  const sni = normalizeHost(settings.sni) || baseHost;
  const path = buildPath(settings, settings.multiUser ? user.token : '');
  const frag = settings.fragment && settings.fragment.enabled
    ? settings.fragment.length + ',' + settings.fragment.interval + ',tlshello'
    : '';

  // حالت پیش‌فرض: اتصال به هاست اصلی روی پورت‌های منتخب
  const targets = cleanIPs.length
    ? cleanIPs.map(c => ({ address: c.ip, city: c.name, country: c.country, sni }))
    : [{ address: baseHost, city: baseHost, country: '', sni }];

  let num = 1;
  for (const target of targets) {
    // برای IP تمیز هر بار یک پورت چرخشی؛ برای هاست اصلی، همه پورت‌ها
    const portList = cleanIPs.length ? [ports[(num - 1) % ports.length]] : ports;
    for (const port of portList) {
      for (const proto of protos) {
        const ctx = {
          name: user.name,
          proto: proto === 'vless' ? 'VLESS' : 'Trojan',
          host: baseHost,
          ip: target.address,
          city: target.city,
          country: target.country,
          flag: flagOf(target.country),
          num,
        };
        const name = applyNaming(settings.naming, ctx);
        const common = {
          address: target.address,
          port: Number(port),
          /* TLS را برای هر پورت جداگانه حساب می‌کنیم: پورت ۸۰ روی کلادفلر
             فقط HTTPِ ساده است و نوشتنِ security=tls برایش نودِ همیشه‌خراب می‌سازد. */
          tls: !!settings.tls && portSupportsTls(port),
          sni: target.sni,
          allowInsecure: !!settings.allowInsecure,
          hostHeader: baseHost,
          path,
          name,
          fragment: frag,
          ech: !!settings.ech,
        };
        if (proto === 'vless') {
          nodes.push(Object.assign({ kind: 'vless', uuid: user.uuid }, common));
        } else {
          nodes.push(Object.assign({ kind: 'trojan', password: user.trojanPass || user.uuid, uuid: user.uuid }, common));
        }
        num++;
      }
    }
  }
  return nodes;
}

function nodeToLink(node) {
  return node.kind === 'vless'
    ? buildVlessLink(node)
    : buildTrojanLink(Object.assign({}, node, { password: node.password || node.uuid }));
}

/* ------------------------------- Clash ------------------------------- */

function clashNode(node) {
  const wsOpts = [
    '      path: "' + (node.path || '/') + '"',
    '      headers:',
    '        Host: "' + (node.hostHeader || '') + '"',
  ];
  if (node.kind === 'vless') {
    return [
      '  - name: "' + String(node.name).replace(/"/g, '\\"') + '"',
      '    type: vless',
      '    server: ' + node.address,
      '    port: ' + node.port,
      '    uuid: ' + node.uuid,
      '    network: ws',
      '    tls: ' + (node.tls ? 'true' : 'false'),
      node.tls ? '    servername: ' + node.sni : null,
      node.tls ? '    client-fingerprint: randomized' : null,
      node.allowInsecure ? '    skip-cert-verify: true' : '    skip-cert-verify: false',
      '    udp: true',
      '    ws-opts:',
    ].concat(wsOpts).filter(Boolean).join('\n');
  }
  return [
    '  - name: "' + String(node.name).replace(/"/g, '\\"') + '"',
    '    type: trojan',
    '    server: ' + node.address,
    '    port: ' + node.port,
    '    password: "' + String(node.password || node.uuid).replace(/"/g, '\\"') + '"',
    '    network: ws',
    '    tls: ' + (node.tls ? 'true' : 'false'),
    node.tls ? '    servername: ' + node.sni : null,
    node.tls ? '    client-fingerprint: randomized' : null,
    node.allowInsecure ? '    skip-cert-verify: true' : '    skip-cert-verify: false',
    '    udp: true',
    '    ws-opts:',
  ].concat(wsOpts).filter(Boolean).join('\n');
}

function buildClashConfig(nodes, settings) {
  const names = nodes.map(n => '"' + String(n.name).replace(/"/g, '\\"') + '"');
  const groups = [
    'proxy-groups:',
    '  - name: "🏛️ ' + PANEL_FA + '"',
    '    type: select',
    '    proxies:',
  ].concat(names.map(n => '      - ' + n)).join('\n');

  const fallbacks = [
    '  - name: "⚡ Auto"',
    '    type: url-test',
    '    url: "https://www.gstatic.com/generate_204"',
    '    interval: 300',
    '    tolerance: 50',
    '    proxies:',
  ].concat(names.map(n => '      - ' + n)).join('\n');

  const rules = [
    'rules:',
    '  - MATCH,🏛️ ' + PANEL_FA,
  ].join('\n');

  const head = [
    '# تخت جمشید — generated by Takht-e Jamshid v' + VERSION,
    'port: 7890',
    'socks-port: 7891',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'external-controller: 127.0.0.1:9090',
    'dns:',
    '  enable: true',
    '  enhanced-mode: fake-ip',
    '  nameserver:',
    '    - https://1.1.1.1/dns-query',
    '    - https://8.8.8.8/dns-query',
    'proxies:',
  ].join('\n');

  return head + '\n' + nodes.map(clashNode).join('\n') + '\n' + groups + '\n' + fallbacks + '\n' + rules + '\n';
}

/* ----------------------------- Sing-box ----------------------------- */

function buildSingboxConfig(nodes, settings) {
  const outbounds = nodes.map((n, i) => {
    const base = {
      type: n.kind === 'vless' ? 'vless' : 'trojan',
      tag: n.name + ' ' + (i + 1),
      server: n.address,
      server_port: Number(n.port),
      transport: {
        type: 'ws',
        path: n.path || '/',
        headers: { Host: n.hostHeader || '' },
        max_early_data: 2048,
        early_data_header_name: 'Sec-WebSocket-Protocol',
      },
    };
    if (n.kind === 'vless') {
      base.uuid = n.uuid;
      base.packet_encoding = 'xudp';
    } else {
      base.password = n.password || n.uuid;
    }
    if (n.tls) {
      base.tls = {
        enabled: true,
        server_name: n.sni,
        insecure: !!n.allowInsecure,
        utls: { enabled: true, fingerprint: 'randomized' },
        alpn: ['http/1.1'],
      };
      // ECH (Encrypted Client Hello) — پشتیبانی در کلاینت‌های Sing-box
      if (n.ech) base.tls.ech = { enabled: true };
    }
    return base;
  });

  const tags = outbounds.map(o => o.tag);

  return JSON.stringify({
    log: { level: 'info' },
    dns: {
      servers: [{ tag: 'cf', address: 'https://1.1.1.1/dns-query' }],
    },
    outbounds: outbounds.concat([
      { type: 'selector', tag: 'select', outbounds: tags },
      { type: 'urltest', tag: 'auto', outbounds: tags, url: 'https://www.gstatic.com/generate_204', interval: '5m' },
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
    ]),
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { clash_mode: 'direct', outbound: 'direct' },
        { clash_mode: 'global', outbound: 'select' },
      ],
      final: 'select',
      auto_detect_interface: true,
    },
  }, null, 2);
}

/* ------------------------- خروجی اشتراک ------------------------- */

function buildSubscription(user, settings, hostInfo, format) {
  const nodes = buildNodesForUser(user, settings, hostInfo);
  const fmt = String(format || 'auto').toLowerCase();

  if (fmt === 'clash' || fmt === 'clash-meta') {
    return { body: buildClashConfig(nodes, settings), type: 'text/yaml; charset=utf-8', count: nodes.length };
  }
  if (fmt === 'singbox' || fmt === 'sing-box' || fmt === 'sb') {
    return { body: buildSingboxConfig(nodes, settings), type: 'application/json; charset=utf-8', count: nodes.length };
  }
  if (fmt === 'raw' || fmt === 'plain') {
    return { body: nodes.map(nodeToLink).join('\n'), type: 'text/plain; charset=utf-8', count: nodes.length };
  }
  const raw = nodes.map(nodeToLink).join('\n');
  return { body: b64encode(raw), type: 'text/plain; charset=utf-8', count: nodes.length };
}

/* اطلاعات هدر subscription-info (مصرف/انقضا) برای کلاینت‌ها */
function buildSubHeaders(user) {
  const total = user.quota || 0;
  const used = user.used || 0;
  const left = Math.max(0, total - used);
  const expire = user.expireAt ? Math.floor(user.expireAt / 1000) : 0;
  return {
    'subscription-userinfo': 'upload=0; download=' + used + '; total=' + total + '; expire=' + expire,
    'profile-update-interval': '12',
    'profile-title': 'base64:' + b64encode(PANEL_FA + ' | ' + user.name),
  };
}

/* ---------- 05_qr.js -------------------------------------------------- */
/* ==========================================================================
   05_qr.js — تولیدکننده QR Code (بدون وابستگی خارجی)
   پیاده‌سازی استاندارد ISO/IEC 18004 · حالت Byte · انتخاب خودکار نسخه و ماسک
   ========================================================================== */

/* تعداد کدواژه‌های تصحیح خطا به‌ازای هر بلوک [نسخه][L,M,Q,H] */
const QR_EC_CW = [ [-1,-1,-1,-1], [7,10,13,17], [10,16,22,28], [15,26,36,44], [20,36,52,64], [26,48,72,88], [36,64,96,112], [40,72,108,130], [48,88,132,156], [60,110,160,192], [72,130,192,224], [80,150,224,264], [96,176,260,308], [104,198,288,352], [120,216,320,384], [132,240,360,432], [144,280,408,480], [168,308,448,532], [180,338,504,588], [196,364,546,650], [224,416,600,700], [224,442,644,750], [252,476,690,816], [270,504,750,900], [300,560,810,960], [312,588,870,1050], [336,644,952,1110], [360,700,1020,1200], [390,728,1050,1260], [420,784,1140,1350], [450,812,1200,1440], [480,868,1290,1530], [510,924,1350,1620], [540,980,1440,1710], [570,1036,1530,1800], [570,1064,1590,1890], [600,1120,1680,1980], [630,1204,1770,2100], [660,1260,1860,2220], [720,1316,1950,2310], [750,1372,2040,2430] ];

/* تعداد بلوک‌های تصحیح خطا [نسخه][L,M,Q,H] */
const QR_EC_BLOCKS = [ [-1,-1,-1,-1], [1,1,1,1], [1,1,1,1], [1,1,2,2], [1,2,2,4], [1,2,4,4], [2,4,4,4], [2,4,6,5], [2,4,6,6], [2,5,8,8], [4,5,8,8], [4,5,8,11], [4,8,10,11], [4,9,12,16], [4,9,16,16], [6,10,12,18], [6,10,17,16], [6,11,16,19], [6,13,18,21], [7,14,21,25], [8,16,20,25], [8,17,23,25], [9,17,23,34], [9,18,25,30], [10,20,27,32], [12,21,29,35], [12,23,34,37], [12,25,34,40], [13,26,35,42], [14,28,38,45], [15,29,40,48], [16,31,43,51], [17,33,45,54], [18,35,48,57], [19,37,51,60], [19,38,53,63], [20,40,56,66], [21,43,59,70], [22,45,62,74], [24,47,65,77], [25,49,68,81] ];

const QR_ECL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
const QR_ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const PENALTY_N1 = 3, PENALTY_N2 = 3, PENALTY_N3 = 40, PENALTY_N4 = 10;

function qrGfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function qrRsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = qrGfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = qrGfMul(root, 0x02);
  }
  return result;
}

function qrRsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let j = 0; j < divisor.length; j++) result[j] ^= qrGfMul(divisor[j], factor);
  }
  return result;
}

function qrRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function qrDataCodewords(ver, eclIdx) {
  // QR_EC_CW تعدادِ کل کدواژه‌های تصحیح خطای آن نسخه است
  return Math.floor(qrRawDataModules(ver) / 8) - QR_EC_CW[ver][eclIdx];
}

function qrCharCountBits(ver) {
  return ver < 10 ? 8 : 16;
}

function qrAlignmentPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const last = ver * 4 + 10;                 // برابر با size - 7
  let step;
  if (ver === 32) {
    step = 26;                               // استثنای استاندارد برای نسخه ۳۲
  } else {
    step = Math.ceil((last - 6) / (numAlign - 1));
    if (step % 2 !== 0) step++;              /* فاصله باید زوج باشد */
  }
  const result = new Array(numAlign);
  result[0] = 6;
  for (let i = numAlign - 1, pos = last; i >= 1; i--, pos -= step) result[i] = pos;
  return result;
}

function getBit(value, i) {
  return ((value >>> i) & 1) !== 0;
}

/**
 * تولید ماتریس QR
 * @returns {{size:number, modules:boolean[][], version:number}}
 */
function qrEncode(text, eclName) {
  const ecl = String(eclName || 'M').toUpperCase();
  const eclIdx = QR_ECL_INDEX[ecl] === undefined ? 1 : QR_ECL_INDEX[ecl];
  const eclBits = QR_ECL_BITS[ecl] === undefined ? 0 : QR_ECL_BITS[ecl];
  const data = new TextEncoder().encode(String(text));

  let version = -1;
  for (let v = 1; v <= 40; v++) {
    const capacity = qrDataCodewords(v, eclIdx) * 8;
    const needed = 4 + qrCharCountBits(v) + data.length * 8;
    if (needed <= capacity) { version = v; break; }
  }
  if (version < 0) throw new Error('QR: داده بیش از حد طولانی است');

  /* --- بیت‌های داده --- */
  const bits = [];
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(4, 4);                              // حالت Byte
  push(data.length, qrCharCountBits(version));
  for (let i = 0; i < data.length; i++) push(data[i], 8);

  const numData = qrDataCodewords(version, eclIdx);
  push(0, Math.min(4, numData * 8 - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < numData * 8; pad ^= 0xec ^ 0x11) push(pad, 8);

  const dataCodewords = new Uint8Array(numData);
  for (let i = 0; i < bits.length; i++) dataCodewords[i >>> 3] |= bits[i] << (7 - (i & 7));

  /* --- کدواژه‌های تصحیح خطا و درهم‌بافی --- */
  const numBlocks = QR_EC_BLOCKS[version][eclIdx];
  const blockEccLen = QR_EC_CW[version][eclIdx] / numBlocks;  // کدواژه به‌ازای هر بلوک
  const rawCodewords = Math.floor(qrRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = qrRsDivisor(blockEccLen);

  const blocks = [];
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const dat = dataCodewords.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    // بلوک همیشه shortBlockLen+1 است؛ بلوک‌های کوتاه یک بایت صفرِ میانی دارند
    const ecc = qrRsRemainder(dat, divisor);
    const blk = Array.from(dat);
    if (i < numShortBlocks) blk.push(0);
    for (let j = 0; j < ecc.length; j++) blk.push(ecc[j]);
    blocks.push(blk);
  }

  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) codewords.push(blocks[j][i]);
    }
  }

  /* --- ساخت ماتریس --- */
  const size = version * 4 + 17;
  const modules = [], isFunc = [];
  for (let i = 0; i < size; i++) {
    modules.push(new Array(size).fill(false));
    isFunc.push(new Array(size).fill(false));
  }
  const setFunc = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark; isFunc[y][x] = true;
  };
  const setAll = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
  };

  // الگوهای زمان‌بندی
  for (let i = 0; i < size; i++) { setFunc(6, i, i % 2 === 0); setFunc(i, 6, i % 2 === 0); }

  // الگوهای یابنده
  const drawFinder = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < size && yy < size) setFunc(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);

  // الگوهای هم‌تراز
  const alignPos = qrAlignmentPositions(version);
  const nAlign = alignPos.length;
  for (let i = 0; i < nAlign; i++) {
    for (let j = 0; j < nAlign; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === nAlign - 1) || (i === nAlign - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunc(alignPos[j] + dx, alignPos[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // بیت‌های قالب (ماسک موقت ۰)
  const drawFormat = (mask) => {
    const d = (eclBits << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fbits = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFunc(8, i, getBit(fbits, i));
    setFunc(8, 7, getBit(fbits, 6));
    setFunc(8, 8, getBit(fbits, 7));
    setFunc(7, 8, getBit(fbits, 8));
    for (let i = 9; i < 15; i++) setFunc(14 - i, 8, getBit(fbits, i));
    for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, getBit(fbits, i));
    for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, getBit(fbits, i));
    setFunc(8, size - 8, true);
  };
  drawFormat(0);

  // بیت‌های نسخه
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(vbits, i);
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFunc(a, b, color); setFunc(b, a, color);
    }
  }

  // قرار دادن داده‌ها به صورت زیگزاگ
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && bi < codewords.length * 8) {
          modules[y][x] = getBit(codewords[bi >>> 3], 7 - (bi & 7));
          bi++;
        }
      }
    }
  }

  /* --- انتخاب بهترین ماسک --- */
  const maskFns = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunc[y][x] && maskFns[mask](x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };

  const penaltyAddHistory = (run, hist) => {
    let r = run;
    if (hist[0] === 0) r += size;
    hist.pop(); hist.unshift(r);
  };
  const penaltyCount = (hist) => {
    const n = hist[1];
    const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
    return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0)
         + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
  };
  const penaltyTerminate = (color, run, hist) => {
    let r = run;
    if (color) { penaltyAddHistory(r, hist); r = 0; }
    r += size;
    penaltyAddHistory(r, hist);
    return penaltyCount(hist);
  };
  const penaltyScore = () => {
    let result = 0;
    // ردیف‌ها
    for (let y = 0; y < size; y++) {
      let runColor = false, runX = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (modules[y][x] === runColor) {
          runX++;
          if (runX === 5) result += PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          penaltyAddHistory(runX, hist);
          if (!runColor) result += penaltyCount(hist) * PENALTY_N3;
          runColor = modules[y][x]; runX = 1;
        }
      }
      result += penaltyTerminate(runColor, runX, hist) * PENALTY_N3;
    }
    // ستون‌ها
    for (let x = 0; x < size; x++) {
      let runColor = false, runY = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (modules[y][x] === runColor) {
          runY++;
          if (runY === 5) result += PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          penaltyAddHistory(runY, hist);
          if (!runColor) result += penaltyCount(hist) * PENALTY_N3;
          runColor = modules[y][x]; runY = 1;
        }
      }
      result += penaltyTerminate(runColor, runY, hist) * PENALTY_N3;
    }
    // بلوک‌های ۲×۲
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += PENALTY_N2;
      }
    }
    // توازن روشن/تاریک
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
    const total = size * size;
    const kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += kk * PENALTY_N4;
    return result;
  };

  let bestMask = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const score = penaltyScore();
    if (score < bestScore) { bestScore = score; bestMask = m; }
    applyMask(m); // برگرداندن
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return { size, modules, isFunction: isFunc, version, mask: bestMask, ecl };
}

/* خروجی SVG */
function qrToSvg(qr, options) {
  const o = options || {};
  const border = o.border === undefined ? 3 : o.border;
  const dark = o.dark || '#1b1207';
  const light = o.light || 'transparent';
  const dim = qr.size + border * 2;
  let path = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += 'M' + (x + border) + ' ' + (y + border) + 'h1v1h-1z';
    }
  }
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR">';
  if (light !== 'transparent') svg += '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>';
  svg += '<path d="' + path + '" fill="' + dark + '"/></svg>';
  return svg;
}

function qrDataUri(text, options) {
  const qr = qrEncode(text, (options && options.ecl) || 'M');
  const svg = qrToSvg(qr, options);
  return 'data:image/svg+xml;base64,' + b64encode(svg);
}

/* ---------- 06_telegram.js -------------------------------------------- */
/* ==========================================================================
   06_telegram.js — ربات مدیریت تلگرام
   ========================================================================== */

async function tgApi(token, method, payload) {
  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  const init = { method: 'POST', headers: { 'content-type': 'application/json' } };
  if (payload) init.body = JSON.stringify(payload);
  const res = await fetch(url, init);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return data || { ok: false };
}

async function tgSend(env, settings, text, keyboard) {
  if (!settings.tgEnabled || !settings.tgToken || !settings.tgChatId) return false;
  const body = {
    chat_id: settings.tgChatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  const res = await tgApi(settings.tgToken, 'sendMessage', body);
  return !!res.ok;
}

async function tgSetWebhook(env, settings, webhookUrl) {
  if (!settings.tgToken) return { ok: false, description: 'توکن تنظیم نشده' };
  const secret = settings.tgSecret || (settings.tgSecret = randomToken(12));
  const res = await tgApi(settings.tgToken, 'setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
  });
  return res;
}

/* ------------------------------ فرمان‌ها ------------------------------ */

function progressBar(percent, width) {
  const w = width || 10;
  const filled = clamp(Math.round((Number(percent) || 0) / 100 * w), 0, w);
  return '█'.repeat(filled) + '░'.repeat(w - filled);
}

async function cmdStatus(env, settings) {
  const users = await listUsers(env);
  let used = 0, quota = 0, active = 0;
  for (const u of users) {
    used += u.used;
    quota += u.quota;
    const alive = u.enabled && (!u.expireAt || u.expireAt > nowMs()) && !(u.quota > 0 && u.used >= u.quota);
    if (alive) active++;
  }
  const lines = [
    '🏛️ <b>تخت جمشید</b> — وضعیت',
    '',
    '👥 کاربران: ' + users.length + '  (فعال: ' + active + ')',
    '📊 مصرف کل: <code>' + formatBytes(used) + '</code>',
    '🎯 سهمیه کل: <code>' + (quota ? formatBytes(quota) : 'نامحدود') + '</code>',
    '📡 پروتکل: <code>' + String(settings.protocol).toUpperCase() + '</code>',
    '🛑 کیل‌سوئیچ: ' + (settings.killSwitch ? 'فعال' : 'غیرفعال'),
  ];
  return lines.join('\n');
}

async function cmdUsers(env) {
  const users = await listUsers(env);
  if (!users.length) return 'هیچ کاربری تعریف نشده است.';
  const lines = ['👥 <b>فهرست کاربران</b>', ''];
  for (const u of users) {
    const pct = u.quota ? Math.round(u.used / u.quota * 100) : 0;
    const dl = daysLeft(u.expireAt);
    const alive = u.enabled && dl > 0 && !(u.quota > 0 && u.used >= u.quota);
    lines.push(
      (alive ? '🟢' : '🔴') + ' <b>' + escapeHtml(u.name) + '</b>\n'
      + '   ' + (u.quota ? progressBar(pct) + ' ' + pct + '%' : '♾️ نامحدود')
      + '  ·  <code>' + formatBytes(u.used) + '</code>\n'
      + '   ⏳ ' + (u.expireAt ? (dl > 0 ? dl + ' روز' : 'منقضی') : 'بدون انقضا')
    );
  }
  return lines.join('\n');
}

async function cmdLink(env, settings, arg, baseUrl) {
  const users = await listUsers(env);
  const u = users.find(x => x.name === arg || x.id === arg);
  if (!u) return 'کاربر «' + escapeHtml(String(arg)) + '» پیدا نشد.';
  const url = baseUrl + '/' + settings.route + '/sub/' + u.token;
  return '🔗 اشتراک <b>' + escapeHtml(u.name) + '</b>\n<code>' + escapeHtml(url) + '</code>';
}

async function cmdAdd(env, settings, args, baseUrl, chatId) {
  const name = String(args[0] || '').trim();
  if (!name) return 'فرمت: <code>/add نام حجم تاریخ‌انقضا(روز)</code>\nمثال: <code>/add ali 30GB 30</code>';
  const quota = String(args[1] || '0');
  const days = Number(args[2] || 0);
  const user = await createUser(env, { name, quota, expireDays: days });
  const url = baseUrl + '/' + settings.route + '/sub/' + user.token;
  return '✅ کاربر <b>' + escapeHtml(user.name) + '</b> ساخته شد.\n'
    + '🔑 شناسه: <code>' + user.uuid + '</code>\n'
    + '📦 حجم: ' + (user.quota ? formatBytes(user.quota) : 'نامحدود') + '\n'
    + '🔗 <code>' + escapeHtml(url) + '</code>';
}

async function cmdDel(env, args) {
  const key = String(args[0] || '').trim();
  if (!key) return 'فرمت: <code>/del نام</code>';
  const users = await listUsers(env);
  const u = users.find(x => x.name === key || x.id === key);
  if (!u) return 'کاربر پیدا نشد.';
  await deleteUser(env, u.id);
  return '🗑 کاربر <b>' + escapeHtml(u.name) + '</b> حذف شد.';
}

async function cmdReset(env, args) {
  const key = String(args[0] || '').trim();
  if (!key) return 'فرمت: <code>/reset نام</code>';
  const users = await listUsers(env);
  const u = users.find(x => x.name === key || x.id === key);
  if (!u) return 'کاربر پیدا نشد.';
  await updateUser(env, u.id, { used: 0 });
  return '♻️ مصرف <b>' + escapeHtml(u.name) + '</b> صفر شد.';
}

const TG_HELP = [
  '🏛️ <b>تخت جمشید</b> — راهنمای ربات',
  '',
  '/status — وضعیت پنل',
  '/users — فهرست کاربران',
  '/add &lt;نام&gt; &lt;حجم&gt; &lt;روز&gt; — افزودن کاربر',
  '/del &lt;نام&gt; — حذف کاربر',
  '/reset &lt;نام&gt; — صفر کردن مصرف',
  '/link &lt;نام&gt; — دریافت لینک اشتراک',
  '/pause — توقف فوری ترافیک',
  '/resume — ازسرگیری ترافیک',
  '/help — این راهنما',
].join('\n');

async function handleTelegramUpdate(env, ctx, settings, update, baseUrl) {
  if (!settings.tgEnabled || !settings.tgToken) return { ok: false, error: 'ربات غیرفعال است' };

  let chatId = null, text = '', isCallback = false, data = '';
  if (update.message && update.message.text) {
    chatId = update.message.chat.id;
    text = update.message.text;
  } else if (update.callback_query) {
    chatId = update.callback_query.message.chat.id;
    data = update.callback_query.data || '';
    isCallback = true;
    text = data;
  }
  if (!chatId) return { ok: true };

  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].split('@')[0].toLowerCase();
  const args = parts.slice(1);
  let reply = '';

  try {
    switch (cmd) {
      case '/start':
      case '/help':
        reply = TG_HELP; break;
      case '/status':
        reply = await cmdStatus(env, settings); break;
      case '/users':
        reply = await cmdUsers(env); break;
      case '/link':
        reply = await cmdLink(env, settings, args[0], baseUrl); break;
      case '/add':
        reply = await cmdAdd(env, settings, args, baseUrl, chatId); break;
      case '/del':
        reply = await cmdDel(env, args); break;
      case '/reset':
        reply = await cmdReset(env, args); break;
      case '/pause':
        settings.killSwitch = true;
        await saveSettings(env, settings);
        reply = '🛑 ترافیک پروکسی متوقف شد.'; break;
      case '/resume':
        settings.killSwitch = false;
        await saveSettings(env, settings);
        reply = '✅ ترافیک پروکسی ازسرگرفته شد.'; break;
      default:
        reply = 'دستور نامشخص. /help را بفرستید.';
    }
  } catch (e) {
    reply = '⚠️ خطا: ' + escapeHtml(String(e && e.message ? e.message : e));
  }

  await tgApi(settings.tgToken, 'sendMessage', {
    chat_id: chatId,
    text: reply,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[
        { text: '📊 وضعیت', callback_data: '/status' },
        { text: '👥 کاربران', callback_data: '/users' },
        { text: '🛑 توقف', callback_data: '/pause' },
        { text: '✅ وصل', callback_data: '/resume' },
      ]],
    },
  });
  return { ok: true };
}

/* ---------- 07_proxy.js ----------------------------------------------- */
/* ==========================================================================
   07_proxy.js — هسته پروکسی: VLESS و Trojan روی WebSocket
   --------------------------------------------------------------------------
   ساختار بسته‌ی ورودی VLESS:
     | 1 | 16 بایت  | 1      | N      | 1   | 2      | 1    | ...  | داده |
     |ver|   UUID   |addonLen| addon  | cmd | port   | atyp | addr |     |
   ساختار بسته‌ی ورودی Trojan:
     | 56 بایت هگز | CRLF | 1   | 1    | آدرس | 2    | CRLF | داده |
     |  password   |      | cmd | atyp |      | port |      |      |
   ========================================================================== */

const CMD_TCP = 0x01;
const CMD_UDP = 0x02;
const CMD_MUX = 0x03;

/* --------------------------- تحلیلگر سرآیندها --------------------------- */

function hexToUuid(bytes) {
  const h = bytesToHex(bytes);
  return h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12);
}

function parseVlessHeader(buf) {
  if (buf.byteLength < 24) return null;
  if (buf[0] !== 0) return null;
  const uuid = hexToUuid(buf.subarray(1, 17));
  const addonLen = buf[17];
  let idx = 18 + addonLen;
  if (buf.byteLength < idx + 4) return null;
  const cmd = buf[idx];
  const port = (buf[idx + 1] << 8) | buf[idx + 2];
  const atyp = buf[idx + 3];
  idx += 4;
  let address = '';
  if (atyp === 1) {
    if (buf.byteLength < idx + 4) return null;
    address = Array.from(buf.subarray(idx, idx + 4)).join('.');
    idx += 4;
  } else if (atyp === 2) {
    const len = buf[idx];
    idx += 1;
    if (buf.byteLength < idx + len) return null;
    address = new TextDecoder().decode(buf.subarray(idx, idx + len));
    idx += len;
  } else if (atyp === 3) {
    if (buf.byteLength < idx + 16) return null;
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(((buf[idx + i * 2] << 8) | buf[idx + i * 2 + 1]).toString(16));
    }
    address = parts.join(':');
    idx += 16;
  } else {
    return null;
  }
  return { protocol: 'vless', uuid, cmd, port, address, atyp, headerLength: idx, addonLen };
}

function parseTrojanHeader(buf) {
  const MIN = 56 + 2 + 1 + 1 + 2 + 2;
  if (buf.byteLength < MIN) return null;
  // رویِ سیم، ۵۶ نویسه‌ی هگزِ حاصل از SHA-224 فرستاده می‌شود (همان‌طور که هست)
  const password = new TextDecoder().decode(buf.subarray(0, 56));
  if (!/^[0-9a-f]{56}$/.test(password)) return null;
  let idx = 56;
  if (buf[idx] !== 0x0d || buf[idx + 1] !== 0x0a) return null;
  idx += 2;
  const cmd = buf[idx]; idx += 1;
  const atyp = buf[idx]; idx += 1;
  let address = '';
  if (atyp === 1) {
    if (buf.byteLength < idx + 4) return null;
    address = Array.from(buf.subarray(idx, idx + 4)).join('.');
    idx += 4;
  } else if (atyp === 3) {
    const len = buf[idx]; idx += 1;
    if (buf.byteLength < idx + len) return null;
    address = new TextDecoder().decode(buf.subarray(idx, idx + len));
    idx += len;
  } else if (atyp === 4) {
    if (buf.byteLength < idx + 16) return null;
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(((buf[idx + i * 2] << 8) | buf[idx + i * 2 + 1]).toString(16));
    address = parts.join(':');
    idx += 16;
  } else {
    return null;
  }
  const port = (buf[idx] << 8) | buf[idx + 1];
  idx += 2;
  if (buf[idx] !== 0x0d || buf[idx + 1] !== 0x0a) return null;
  idx += 2;
  return { protocol: 'trojan', password, cmd, port, address, atyp, headerLength: idx };
}

function parseInboundHeader(buf) {
  return parseVlessHeader(buf) || parseTrojanHeader(buf);
}

/* ------------------------------ خروجی ------------------------------ */

async function socks5Connect(socket, host, port) {
  const writer = socket.writable.getWriter();
  // پیشنهاد: بدون احراز هویت
  await writer.write(new Uint8Array([0x05, 0x01, 0x00]));
  const reader = socket.readable.getReader();
  const resp = (await reader.read()).value;
  reader.releaseLock();
  if (!resp || resp[0] !== 0x05 || resp[1] !== 0x00) throw new Error('SOCKS5 handshake failed');

  // آدرس مقصد
  const isIP = isIPv4(host);
  const hostBytes = new TextEncoder().encode(host);
  const req = [0x05, 0x01, 0x00, isIP ? 0x01 : 0x03];
  const parts = [new Uint8Array(req)];
  if (isIP) {
    parts.push(new Uint8Array(host.split('.').map(Number)));
  } else {
    parts.push(new Uint8Array([hostBytes.byteLength]));
    parts.push(hostBytes);
  }
  parts.push(new Uint8Array([(port >> 8) & 0xff, port & 0xff]));
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  await writer.write(out);

  const resp2 = (await reader.read()).value;
  if (!resp2 || resp2[1] !== 0x00) throw new Error('SOCKS5 request rejected');
  // خواندن باقیمانده‌ی پاسخ
  try { reader.releaseLock(); } catch (e) { /* آزاد شده */ }
  writer.releaseLock();
  return socket;
}

async function outboundConnect(host, port, settings, originalHeader) {
  if (settings.outMode === 'socks5' && settings.socks5) {
    const m = String(settings.socks5).match(/^(?:([^:@]*)(?::([^@]*))?@)?([^:]+):(\d+)$/);
    if (!m) throw new Error('SOCKS5 نامعتبر');
    const sock = connect({ hostname: m[3], port: Number(m[4]) });
    await sock.opened;
    await socks5Connect(sock, host, port);
    return sock;
  }
  if (settings.outMode === 'proxyip' && settings.proxyIP) {
    // مقصدِ واسط یک سرور VLESS/Trojan است؛ همان سرآیند برایش فرستاده می‌شود
    const m = String(settings.proxyIP).match(/^([^:]+):(\d+)$/);
    if (!m) throw new Error('ProxyIP نامعتبر');
    const sock = connect({ hostname: m[1], port: Number(m[2]) });
    await sock.opened;
    if (originalHeader) {
      const w = sock.writable.getWriter();
      await w.write(originalHeader);
      w.releaseLock();
    }
    return sock;
  }
  const sock = connect({ hostname: host, port: port });
  await sock.opened;
  return sock;
}

/* --------------------------- پرس‌وجوی DNS روی HTTPS --------------------------- */

async function resolveDoH(query, dohUrl) {
  const b64 = b64urlEncode(query);
  const url = dohUrl + '?dns=' + b64;
  const res = await fetch(new Request(url, {
    method: 'GET',
    headers: { accept: 'application/dns-json' },
  }));
  if (!res.ok) throw new Error('DoH failed: ' + res.status);
  const json = await res.json();
  if (!json.Answer || !json.Answer.length) {
    // پاسخ خالی: یک پاسخ با همان شناسه و بدون رکورد
    return buildDnsResponse(query, []);
  }
  return buildDnsResponse(query, json.Answer.map(a => ({ name: a.name, type: a.type, data: a.data })));
}

/* ساخت پاسخ DNS ساده (فقط A و AAAA و CNAME) */
function buildDnsResponse(query, answers) {
  const id = (query[0] << 8) | query[1];
  const body = [];
  // هدر: id, flags(0x8180), qdcount=1, ancount, nscount=0, arcount=0
  const head = new Uint8Array(12);
  head[0] = query[0]; head[1] = query[1];
  head[2] = 0x81; head[3] = 0x80;
  head[4] = 0; head[5] = 1;
  head[6] = (answers.length >> 8) & 0xff; head[7] = answers.length & 0xff;
  head[8] = 0; head[9] = 0; head[10] = 0; head[11] = 0;
  body.push(head);

  // بخش پرسش (تا انتهای نام)
  let idx = 12;
  while (idx < query.length && query[idx] !== 0) idx += query[idx] + 1;
  idx += 1; // بایت صفر پایانی
  body.push(query.subarray(12, idx + 4));

  for (const a of answers) {
    const nameBytes = encodeDnsName(a.name);
    const data = a.data;
    let rdata = null;
    if (a.type === 1 || a.type === 28) {
      if (a.type === 1 && isIPv4(data)) {
        rdata = new Uint8Array(4);
        const p = data.split('.');
        for (let i = 0; i < 4; i++) rdata[i] = Number(p[i]);
      } else if (a.type === 28 && data.indexOf(':') > -1) {
        rdata = new Uint8Array(16);
        const full = expandIPv6(data);
        for (let i = 0; i < 8; i++) {
          rdata[i * 2] = parseInt(full.substr(i * 4, 2), 16);
          rdata[i * 2 + 1] = parseInt(full.substr(i * 4 + 2, 2), 16);
        }
      }
    } else if (a.type === 5) {
      const nb = encodeDnsName(data);
      rdata = nb;
    }
    if (!rdata) continue;
    const rec = new Uint8Array(nameBytes.length + 10 + rdata.length);
    rec.set(nameBytes, 0);
    let o = nameBytes.length;
    rec[o++] = (a.type >> 8) & 0xff; rec[o++] = a.type & 0xff;
    rec[o++] = 0; rec[o++] = 1;      // کلاس IN
    rec[o++] = 0; rec[o++] = 0; rec[o++] = 0; rec[o++] = 60;  // TTL
    rec[o++] = (rdata.length >> 8) & 0xff; rec[o++] = rdata.length & 0xff;
    rec.set(rdata, o);
    body.push(rec);
  }

  let total = 0;
  for (const b of body) total += b.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of body) { out.set(b, off); off += b.length; }
  return out;
}

function encodeDnsName(name) {
  const parts = String(name || '').replace(/\.$/, '').split('.');
  const bytes = [];
  for (const p of parts) {
    const pb = new TextEncoder().encode(p);
    bytes.push(pb.length);
    for (const b of pb) bytes.push(b);
  }
  bytes.push(0);
  return new Uint8Array(bytes);
}

function expandIPv6(addr) {
  let s = String(addr);
  if (s.indexOf('::') > -1) {
    const sides = s.split('::');
    let left = sides[0] ? sides[0].split(':') : [];
    let right = sides[1] ? sides[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const mid = new Array(Math.max(0, missing)).fill('0');
    const all = left.concat(mid, right);
    return all.map(x => String(x || '0').padStart(4, '0')).join('');
  }
  return s.split(':').map(x => String(x || '0').padStart(4, '0')).join('');
}

/* ------------------------- مدیریت اتصال اصلی ------------------------- */

async function handleProxyRequest(request, env, ctx, settings, pathUser) {
  if (settings.killSwitch) {
    return new Response('Kill switch active', { status: 503 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const ws = pair[1];
  ws.accept();

  /* داده‌ی زودهنگام (early data) که کلاینت در هدر Sec-WebSocket-Protocol فرستاده */
  let earlyData = null;
  let earlyProto = '';
  const protoHeader = request.headers.get('sec-websocket-protocol');
  if (protoHeader) {
    const first = protoHeader.split(',')[0].trim();
    earlyProto = first;
    try { earlyData = b64urlDecode(first); } catch (e) { earlyData = null; }
  }

  const state = {
    ws,
    remote: null,
    remoteWriter: null,
    userId: pathUser ? pathUser.id : null,
    user: pathUser || null,
    headerSent: false,
    header: null,
    isUdp: false,
    udpWriter: null,
    closed: false,
    bytesUp: 0,
    bytesDown: 0,
    pending: 0,          /* بایت‌هایی که هنوز به بافر مصرف نرفته‌اند */
  };

  /* شمارش مصرف: در حافظه جمع می‌شود و هر ۶۴ کیلوبایت به بافر D1 منتقل می‌گردد */
  const addBytes = (n) => {
    if (!n) return;
    state.pending += n;
    if (state.pending >= 65536 && state.userId) {
      bufferUsage(state.userId, state.pending);
      state.pending = 0;
      if (ctx && ctx.waitUntil) ctx.waitUntil(flushUsage(env, false));
    }
  };

  const remoteClose = () => {
    if (state.closed) return;
    state.closed = true;
    try { if (state.remote) state.remote.close(); } catch (e) { /* */ }
    try { if (state.remoteWriter) state.remoteWriter.releaseLock(); } catch (e) { /* */ }
    try { ws.close(); } catch (e) { /* */ }
    if (state.userId && state.pending) {
      bufferUsage(state.userId, state.pending);
      if (ctx && ctx.waitUntil) ctx.waitUntil(flushUsage(env, true));
    }
  };

  /* جریان خواندن از WebSocket کلاینت */
  const readable = new ReadableStream({
    start(controller) {
      if (earlyData && earlyData.byteLength) controller.enqueue(earlyData);
      ws.addEventListener('message', (event) => {
        try {
          const data = typeof event.data === 'string' ? new TextEncoder().encode(event.data) : new Uint8Array(event.data);
          controller.enqueue(data);
        } catch (e) { /* سرریز */ }
      });
      ws.addEventListener('close', () => { try { controller.close(); } catch (e) { /* */ } remoteClose(); });
      ws.addEventListener('error', () => { try { controller.error(); } catch (e) { /* */ } remoteClose(); });
    },
    pull() { /* */ },
    cancel() { remoteClose(); },
  });

  const sendToClient = (data) => {
    try {
      if (!state.headerSent) {
        state.headerSent = true;
        if (state.header && state.header.protocol === 'vless') {
          const out = new Uint8Array(data.byteLength + 2);
          out[0] = 0;   // نسخه
          out[1] = 0;   // طول addon
          out.set(data, 2);
          ws.send(out);
          state.bytesDown += out.byteLength;
          addBytes(out.byteLength);
          return;
        }
      }
      ws.send(data);
      state.bytesDown += data.byteLength;
      addBytes(data.byteLength);
    } catch (e) { remoteClose(); }
  };

  const writable = new WritableStream({
    async write(chunk) {
      state.bytesUp += chunk.byteLength;
      addBytes(chunk.byteLength);

      /* حالت UDP: هر بسته با طول ۲ بایتی شروع می‌شود */
      if (state.isUdp && state.udpWriter) {
        return state.udpWriter(chunk);
      }

      /* اگر اتصال برقرار است، فقط عبور بده */
      if (state.remoteWriter) {
        await state.remoteWriter.write(chunk);
        return;
      }

      /* تحلیل سرآیند */
      const header = parseInboundHeader(chunk);
      if (!header) { remoteClose(); return; }

      /* شناسایی و اعتبارسنجی کاربر */
      let user = state.user;
      if (!user) {
        user = header.protocol === 'vless'
          ? await getUserByUuid(env, header.uuid)
          : await getUserByTrojan(env, header.password);
      }
      if (user) {
        if (!user.enabled) { remoteClose(); return; }
        if (user.expireAt && user.expireAt < nowMs()) { remoteClose(); return; }
        if (user.quota > 0 && user.used >= user.quota) { remoteClose(); return; }
        state.user = user;
        state.userId = user.id;
        if (!user.firstUse && settings.startOnFirstUse) {
          if (ctx && ctx.waitUntil) ctx.waitUntil(touchUser(env, user.id));
        }
      } else if (settings.multiUser) {
        remoteClose();  /* کاربر ناشناس پذیرفته نمی‌شود */
        return;
      }

      state.header = header;

      /* مسدودسازی محتوا */
      if ((settings.blockAds || settings.blockPorn) && header.port === 53) {
        // در ادامه، روی پاسخ DNS اعمال می‌شود
      }

      /* UDP */
      const isUdp = (header.protocol === 'vless' && header.cmd === CMD_UDP)
                 || (header.protocol === 'trojan' && header.cmd === CMD_MUX);
      if (isUdp) {
        if (!settings.udp) { remoteClose(); return; }
        state.isUdp = true;
        state.udpWriter = makeUdpWriter(state, settings, sendToClient, remoteClose, chunk, header);
        // پردازش نخستین بسته
        return state.udpWriter(chunk.subarray(header.headerLength));
      }

      if (header.cmd !== CMD_TCP) { remoteClose(); return; }

      /* اتصال به مقصد */
      let socket;
      try {
        socket = await outboundConnect(header.address, header.port, settings, chunk);
      } catch (e) {
        remoteClose();
        return;
      }
      state.remote = socket;
      state.remoteWriter = socket.writable.getWriter();

      /* ارسال داده‌های همراهِ سرآیند */
      const payload = chunk.subarray(header.headerLength);
      if (payload.byteLength) await state.remoteWriter.write(payload);

      /* بازگشت پاسخ به کلاینت */
      socket.readable.pipeTo(new WritableStream({
        write(data) {
          sendToClient(data);
        },
        close() { remoteClose(); },
        abort() { remoteClose(); },
      })).catch(() => remoteClose());
    },
    close() { remoteClose(); },
    abort() { remoteClose(); },
  });

  readable.pipeTo(writable).catch(() => remoteClose());

  /* پژواکِ زیرپروتکل: اگر کلاینت Sec-WebSocket-Protocol فرستاده باشد (مثلاً برای
     early data) و سرور آن را در پاسخ برنگرداند، کلاینت‌های سخت‌گیر — از جمله
     sing-box و برخی نسخه‌های v2rayNG — اتصال را همان‌جا رد می‌کنند و کاربر
     فقط «وصل نمی‌شود» می‌بیند. همان نخستین مقدار را بازمی‌گردانیم. */
  const respHeaders = {};
  if (earlyProto) respHeaders['Sec-WebSocket-Protocol'] = earlyProto;

  return new Response(null, { status: 101, webSocket: client, headers: respHeaders });
}

/* پردازش بسته‌های UDP (در عمل: DNS روی HTTPS) */
function makeUdpWriter(state, settings, sendToClient, remoteClose, firstChunk, header) {
  let buffer = new Uint8Array(0);

  const parsePacket = (data) => {
    if (data.byteLength < 4) return null;
    const len = (data[0] << 8) | data[1];
    if (data.byteLength < len + 2) return null;
    const body = data.subarray(2, 2 + len);
    let idx = 0;
    const atyp = body[idx]; idx += 1;
    let address = '';
    if (atyp === 1) { address = Array.from(body.subarray(idx, idx + 4)).join('.'); idx += 4; }
    else if (atyp === 2 || atyp === 3) {
      const l = body[idx]; idx += 1;
      address = new TextDecoder().decode(body.subarray(idx, idx + l)); idx += l;
    } else if (atyp === 4) {
      const parts = [];
      for (let i = 0; i < 8; i++) parts.push(((body[idx + i * 2] << 8) | body[idx + i * 2 + 1]).toString(16));
      address = parts.join(':'); idx += 16;
    } else return null;
    const port = (body[idx] << 8) | body[idx + 1];
    idx += 2;
    return { address, port, payload: body.subarray(idx), consumed: len + 2 };
  };

  return async (chunk) => {
    const joined = new Uint8Array(buffer.byteLength + chunk.byteLength);
    joined.set(buffer, 0);
    joined.set(chunk, buffer.byteLength);
    buffer = joined;

    while (buffer.byteLength) {
      const pkt = parsePacket(buffer);
      if (!pkt) break;
      buffer = buffer.subarray(pkt.consumed);

      if (pkt.port === 53) {
        try {
          const answer = await resolveDoH(pkt.payload, settings.doh || DEFAULT_SETTINGS.doh);
          const out = new Uint8Array(answer.byteLength + 2);
          out[0] = (answer.byteLength >> 8) & 0xff;
          out[1] = answer.byteLength & 0xff;
          out.set(answer, 2);
          sendToClient(out);
        } catch (e) { /* در صورت خطا، بسته نادیده گرفته می‌شود */ }
      }
      /* ترافیک UDP غیرـDNS روی Workers پشتیبانی نمی‌شود */
    }
  };
}

/* ---------- 08_ui.js -------------------------------------------------- */
/* ==========================================================================
   08_ui.js — رابط کاربری پنل (تم تخت‌جمشید)
   ========================================================================== */

const CSS = `
:root{
  --gold:#d9b45b; --gold-2:#f0dca0; --gold-dark:#8c6d21;
  --lapis:#1b3a6b; --lapis-2:#24478f;
  --turq:#3fd0c9; --stone:#14110d; --stone-2:#1c1813; --stone-3:#262017;
  --cream:#f3e9d2; --muted:#a99e86;
  --ok:#4ade80; --warn:#fbbf24; --bad:#f87171;
  --line:rgba(217,180,91,.22);
  --card:rgba(30,25,18,.86);
  --radius:14px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(27,58,107,.35), transparent 60%),
    radial-gradient(900px 500px at 0% 100%, rgba(217,180,91,.10), transparent 60%),
    linear-gradient(160deg,#0f0d0a 0%, #17140f 50%, #100e0b 100%);
  background-attachment:fixed;
  color:var(--cream);
  font-family:"Vazirmatn","IRANSans","Shabnam",Tahoma,"Segoe UI",system-ui,sans-serif;
  min-height:100vh; font-size:14px; line-height:1.7;
}
body.light{
  background:
    radial-gradient(1000px 500px at 85% -10%, rgba(36,71,143,.12), transparent 60%),
    linear-gradient(160deg,#f7f1e3 0%,#efe6d2 100%);
  color:#2a2418; --card:rgba(255,252,245,.94); --line:rgba(140,109,33,.28); --muted:#6b6152;
}
a{color:var(--turq);text-decoration:none}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:rgba(217,180,91,.28);border-radius:8px}
::-webkit-scrollbar-track{background:transparent}

/* ---------- طرح تزیینی پارسه ---------- */
.frieze{height:14px;width:100%;opacity:.55;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='14' viewBox='0 0 40 14'><path d='M0 13 L6 3 L12 13 L18 3 L24 13 L30 3 L36 13 L40 7' fill='none' stroke='%23d9b45b' stroke-width='1'/></svg>");
  background-repeat:repeat-x;}

/* ---------- ورود ---------- */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.login-card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line);
  border-radius:20px;padding:28px;box-shadow:0 30px 80px rgba(0,0,0,.55);backdrop-filter:blur(8px)}
.login-card .hero{display:block;margin:0 auto 10px}
.login-title{text-align:center;font-size:19px;font-weight:700;letter-spacing:.4px}
.login-sub{text-align:center;color:var(--muted);font-size:12px;margin-bottom:18px}

/* ---------- چیدمان ---------- */
.app{display:grid;grid-template-columns:230px 1fr;min-height:100vh}
.sidebar{border-inline-end:1px solid var(--line);padding:18px 14px;background:rgba(0,0,0,.22);
  backdrop-filter:blur(6px);position:sticky;top:0;height:100vh;overflow:auto}
.brand{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.brand h1{font-size:15px;margin:0;letter-spacing:.3px}
.brand small{display:block;color:var(--muted);font-size:10.5px;font-weight:400}
.nav{display:flex;flex-direction:column;gap:3px;margin-top:16px}
.nav button{all:unset;cursor:pointer;display:flex;align-items:center;gap:9px;padding:9px 11px;
  border-radius:10px;color:var(--muted);font-size:13px;transition:.15s;width:100%}
.nav button:hover{background:rgba(217,180,91,.09);color:var(--cream)}
.nav button.active{background:linear-gradient(90deg,rgba(217,180,91,.20),rgba(217,180,91,.04));
  color:var(--gold-2);box-shadow:inset 0 0 0 1px rgba(217,180,91,.25)}
.nav .sep{height:1px;background:var(--line);margin:10px 4px}
.main{padding:20px 24px 60px;max-width:1180px}

/* ---------- نوار بالا ---------- */
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:16px;flex-wrap:wrap}
.topbar h2{margin:0;font-size:20px;letter-spacing:.3px}
.topbar .sub{color:var(--muted);font-size:12px;margin-top:2px}
.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}

/* ---------- کارت‌ها ---------- */
.grid{display:grid;gap:14px}
.g4{grid-template-columns:repeat(4,1fr)}
.g3{grid-template-columns:repeat(3,1fr)}
.g2{grid-template-columns:repeat(2,1fr)}
@media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{position:static;height:auto}
  .g4,.g3,.g2{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.g4,.g3,.g2{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px;
  position:relative;overflow:hidden}
.card::before{content:"";position:absolute;inset:0 0 auto 0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(217,180,91,.5),transparent)}
.card h3{margin:0 0 10px;font-size:13.5px;color:var(--gold-2);letter-spacing:.3px;
  display:flex;align-items:center;gap:7px}
.stat .label{color:var(--muted);font-size:11.5px}
.stat .value{font-size:22px;font-weight:700;letter-spacing:.5px;margin-top:4px}
.stat .hint{font-size:11px;color:var(--muted);margin-top:2px}
.bar{height:6px;border-radius:6px;background:rgba(217,180,91,.14);overflow:hidden;margin-top:9px}
.bar > i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--turq))}

/* ---------- فرم‌ها ---------- */
label{display:block;font-size:12px;color:var(--muted);margin:10px 0 5px}
input,select,textarea{width:100%;padding:9px 11px;border-radius:10px;
  background:rgba(0,0,0,.30);border:1px solid var(--line);color:var(--cream);
  font-family:inherit;font-size:13px;outline:none;transition:.15s}
body.light input,body.light select,body.light textarea{background:rgba(255,255,255,.75);color:#241f16}
input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(217,180,91,.14)}
textarea{min-height:96px;resize:vertical;direction:ltr;text-align:left;font-size:12px;line-height:1.6}
.row{display:grid;gap:10px}
.row2{grid-template-columns:1fr 1fr}
.row3{grid-template-columns:1fr 1fr 1fr}
@media(max-width:720px){.row2,.row3{grid-template-columns:1fr}}
.switch{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:9px 0;border-bottom:1px dashed var(--line)}
.switch:last-child{border-bottom:0}
.toggle{width:44px;height:24px;border-radius:24px;background:rgba(255,255,255,.12);
  position:relative;cursor:pointer;transition:.2s;flex:0 0 auto;border:0}
.toggle::after{content:"";position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;
  border-radius:50%;background:var(--cream);transition:.2s}
.toggle.on{background:linear-gradient(90deg,var(--gold),var(--turq))}
.toggle.on::after{transform:translateX(20px)}
body[dir="rtl"] .toggle.on::after{transform:translateX(-20px)}

/* ---------- دکمه‌ها ---------- */
.btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  padding:8px 14px;border-radius:10px;font-size:12.5px;
  background:linear-gradient(180deg,rgba(217,180,91,.22),rgba(217,180,91,.08));
  border:1px solid rgba(217,180,91,.35);color:var(--gold-2);transition:.15s;white-space:nowrap}
.btn:hover{background:linear-gradient(180deg,rgba(217,180,91,.34),rgba(217,180,91,.14));
  transform:translateY(-1px)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn.primary{background:linear-gradient(135deg,var(--gold),#b8912f);color:#1b1508;font-weight:700;border-color:transparent}
.btn.ghost{background:transparent;border-color:var(--line);color:var(--muted)}
.btn.ghost:hover{color:var(--cream);border-color:var(--gold)}
.btn.danger{border-color:rgba(248,113,113,.45);color:var(--bad);background:rgba(248,113,113,.10)}
.btn.sm{padding:5px 9px;font-size:11.5px}
.btn.block{width:100%;justify-content:center}

/* ---------- جدول ---------- */
.table-wrap{overflow:auto;border-radius:12px;border:1px solid var(--line)}
table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px}
th,td{padding:10px 12px;text-align:start;border-bottom:1px solid var(--line);vertical-align:middle}
th{background:rgba(217,180,91,.07);color:var(--gold-2);font-weight:600;font-size:11.5px;
  position:sticky;top:0;backdrop-filter:blur(4px)}
tbody tr:hover{background:rgba(217,180,91,.05)}
tbody tr:last-child td{border-bottom:0}
.pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10.5px;border:1px solid}
.pill.ok{color:var(--ok);border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.10)}
.pill.bad{color:var(--bad);border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.10)}
.pill.warn{color:var(--warn);border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.10)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;direction:ltr}
.ellipsis{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle}

/* ---------- مودال ---------- */
.mask{position:fixed;inset:0;background:rgba(0,0,0,.66);backdrop-filter:blur(3px);
  display:none;align-items:center;justify-content:center;padding:20px;z-index:60}
.mask.show{display:flex}
.modal{width:100%;max-width:520px;max-height:86vh;overflow:auto;background:var(--card);
  border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.modal h3{margin:0 0 14px;color:var(--gold-2);font-size:15px}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}

/* ---------- QR ---------- */
.qrbox{background:#f7f1e3;padding:14px;border-radius:14px;display:inline-block;line-height:0}
.qrbox img{width:190px;height:190px;display:block}
.qrrow{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}

/* ---------- متفرقه ---------- */
.toast{position:fixed;bottom:22px;inset-inline-start:50%;transform:translate(-50%,80px);
  background:linear-gradient(135deg,var(--gold),#b8912f);color:#1b1508;padding:10px 20px;
  border-radius:12px;font-size:13px;font-weight:600;opacity:0;transition:.25s;z-index:99;
  box-shadow:0 12px 34px rgba(0,0,0,.4)}
.toast.show{opacity:1;transform:translate(-50%,0)}
.muted{color:var(--muted);font-size:11.5px}
.hide{display:none !important}
.tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tabs button{all:unset;cursor:pointer;padding:6px 13px;border-radius:99px;font-size:12px;
  border:1px solid var(--line);color:var(--muted)}
.tabs button.active{background:rgba(217,180,91,.18);color:var(--gold-2);border-color:var(--gold)}
.linkbox{display:flex;gap:8px;align-items:center}
.linkbox input{flex:1}
.kv{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:12.5px}
.kv:last-child{border-bottom:0}
.kv b{font-weight:600;direction:ltr}
.logline{font-size:11.5px;padding:5px 0;border-bottom:1px dashed var(--line);direction:ltr;text-align:left}
.empty{text-align:center;color:var(--muted);padding:26px 10px;font-size:12.5px}
`;

/* نشان تخت جمشید: دو ستون با سرستون گاوی و دیسک بال‌دار */
const HERO_SVG = '<svg class="hero" width="228" height="86" viewBox="0 0 228 86" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="تخت جمشید">'
  + '<defs>'
  + '<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dca0"/><stop offset=".55" stop-color="#d9b45b"/><stop offset="1" stop-color="#8c6d21"/></linearGradient>'
  + '<linearGradient id="g2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3fd0c9"/><stop offset="1" stop-color="#1b3a6b"/></linearGradient>'
  + '</defs>'
  /* سکو */
  + '<rect x="14" y="72" width="200" height="7" rx="2" fill="url(#g1)"/>'
  + '<rect x="24" y="64" width="180" height="7" rx="2" fill="url(#g1)" opacity=".72"/>'
  /* شفت ستون‌ها */
  + '<rect x="52" y="34" width="11" height="31" fill="url(#g1)"/>'
  + '<rect x="165" y="34" width="11" height="31" fill="url(#g1)"/>'
  + '<rect x="55.5" y="34" width="1.2" height="31" fill="#8c6d21" opacity=".5"/>'
  + '<rect x="168.5" y="34" width="1.2" height="31" fill="#8c6d21" opacity=".5"/>'
  /* سرستون‌های گاودار (ساده‌شده) */
  + '<path d="M40 34h35v-4l-9-7 9-7h-35z" fill="url(#g1)"/>'
  + '<path d="M153 34h35v-18h-35l9 7-9 7z" fill="url(#g1)"/>'
  /* دیسک بال‌دار */
  + '<g transform="translate(114 22)">'
  + '<circle r="7" fill="url(#g1)"/>'
  + '<circle r="3" fill="#14110d" opacity=".45"/>'
  + '<path d="M-7 0c-9-2-18-6-31-12 11 1 20 4 31 9z" fill="url(#g1)" opacity=".95"/>'
  + '<path d="M7 0c9-2 18-6 31-12-11 1-20 4-31 9z" fill="url(#g1)" opacity=".95"/>'
  + '<path d="M-7 2c-8 1-15 4-25 9 9-1 17-3 25-6z" fill="url(#g1)" opacity=".6"/>'
  + '<path d="M7 2c8 1 15 4 25 9-9-1-17-3-25-6z" fill="url(#g1)" opacity=".6"/>'
  + '<path d="M-2 7l-6 11 6-3 6 3z" fill="url(#g1)" opacity=".8"/>'
  + '</g>'
  /* خطوط کتیبه */
  + '<g opacity=".5" fill="#d9b45b">'
  + '<rect x="76" y="74" width="9" height="2"/><rect x="90" y="74" width="5" height="2"/><rect x="99" y="74" width="12" height="2"/>'
  + '<rect x="117" y="74" width="7" height="2"/><rect x="128" y="74" width="11" height="2"/><rect x="143" y="74" width="4" height="2"/>'
  + '</g>'
  + '</svg>';

/* ------------------------------- صفحه ورود ------------------------------- */

function renderLogin(route, lang, error, host) {
  const fa = lang !== 'en';
  return '<!DOCTYPE html><html lang="' + (fa ? 'fa' : 'en') + '" dir="' + (fa ? 'rtl' : 'ltr') + '"><head>'
    + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow">'
    + '<title>' + PANEL_FA + ' | ' + (fa ? 'ورود' : 'Sign in') + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<div class="login-wrap"><div class="login-card">'
    + HERO_SVG
    + '<div class="frieze" style="margin:12px 0 16px"></div>'
    + '<div class="login-title">' + PANEL_FA + '</div>'
    + '<div class="login-sub">' + (fa ? 'پنل لبه‌ای پارسه · نسخه ' + VERSION : 'Persepolis Edge Panel · v' + VERSION) + '</div>'
    + (error ? '<div style="background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.4);color:#f87171;padding:8px 12px;border-radius:10px;font-size:12px;margin-bottom:12px;text-align:center">' + escapeHtml(error) + '</div>' : '')
    + '<form method="post" action="/' + route + '/login">'
    + '<label>' + (fa ? 'نام کاربری' : 'Username') + '</label>'
    + '<input name="user" autocomplete="username" autocapitalize="off" required>'
    + '<label>' + (fa ? 'گذرواژه' : 'Password') + '</label>'
    + '<input name="pass" type="password" autocomplete="current-password" required>'
    + '<button class="btn primary block" style="margin-top:18px" type="submit">' + (fa ? 'ورود به پنل' : 'Enter the panel') + '</button>'
    + '</form>'
    + '<div class="muted" style="text-align:center;margin-top:14px">' + (fa ? 'پیش‌فرض: admin / admin — پس از ورود حتماً تغییر دهید' : 'Default: admin / admin — change it after login') + '</div>'
    + '</div></div></body></html>';
}

/* --------------------------- صفحه وضعیت اشتراک --------------------------- */

function renderStatusPage(user, settings, qrSvg, baseUrl, nodes) {
  const pct = user.quota ? clamp(Math.round(user.used / user.quota * 100), 0, 100) : 0;
  const dl = daysLeft(user.expireAt);
  const alive = user.enabled && dl > 0 && !(user.quota > 0 && user.used >= user.quota);
  const subUrl = baseUrl + '/' + settings.route + '/sub/' + user.token;
  return '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow">'
    + '<title>' + PANEL_FA + ' | ' + escapeHtml(user.name) + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<div class="login-wrap"><div class="login-card" style="max-width:520px">'
    + HERO_SVG
    + '<div class="frieze" style="margin:10px 0 14px"></div>'
    + '<div class="login-title">' + escapeHtml(user.name) + '</div>'
    + '<div class="login-sub">' + (alive ? '🟢 سرویس فعال' : '🔴 سرویس غیرفعال') + '</div>'
    + '<div class="qrrow" style="justify-content:center;margin:16px 0">'
    + '<div class="qrbox"><img src="' + qrSvg + '" alt="QR"></div>'
    + '<div style="flex:1;min-width:200px">'
    + '<div class="kv"><span>مصرف</span><b>' + formatBytes(user.used) + '</b></div>'
    + '<div class="kv"><span>سهمیه</span><b>' + (user.quota ? formatBytes(user.quota) : 'نامحدود') + '</b></div>'
    + '<div class="kv"><span>باقیمانده</span><b>' + (user.quota ? formatBytes(Math.max(0, user.quota - user.used)) : '∞') + '</b></div>'
    + '<div class="kv"><span>انقضا</span><b>' + (user.expireAt ? formatDate(user.expireAt, 'fa') + ' (' + dl + ' روز)' : 'ندارد') + '</b></div>'
    + '<div class="bar" style="margin-top:10px"><i style="width:' + pct + '%"></i></div>'
    + '<div class="muted" style="margin-top:6px">تعداد نودها: ' + nodes + '</div>'
    + '</div></div>'
    + '<div class="linkbox"><input id="sub" class="mono" readonly value="' + escapeHtml(subUrl) + '">'
    + '<button class="btn sm" onclick="var e=document.getElementById(\'sub\');e.select();navigator.clipboard.writeText(e.value)">کپی</button></div>'
    + '<div class="tabs" style="justify-content:center;margin-top:14px">'
    + '<a class="btn sm ghost" href="' + escapeHtml(subUrl) + '">Base64</a>'
    + '<a class="btn sm ghost" href="' + escapeHtml(subUrl) + '?format=clash">Clash</a>'
    + '<a class="btn sm ghost" href="' + escapeHtml(subUrl) + '?format=singbox">Sing-box</a>'
    + '</div>'
    + '</div></div></body></html>';
}

/* ------------------------------ بدنه پنل ------------------------------ */

const CLIENT_JS = [
  'var S=null, TAB="overview", THEME="dark", LANG="fa";',
  'var API="/__ROUTE__/api";',
  'function $(id){return document.getElementById(id)}',
  'function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}',
  'async function jpost(path,body){',
  '  var r=await fetch(API+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});',
  '  var j=await r.json().catch(function(){return{ok:false,error:"پاسخ نامعتبر"}});',
  '  if(!j.ok) toast(j.error||"خطا"); return j;',
  '}',
  'async function jget(path){var r=await fetch(API+path);return await r.json().catch(function(){return{ok:false}})}',
  'function toast(msg){var t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove("show")},2600)}',
  'function fmtBytes(b){if(!b)return "0 B";var k=1024,u=["B","KB","MB","GB","TB"],i=Math.floor(Math.log(b)/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(2))+" "+u[i]}',
  'function daysLeft(ms){if(!ms)return Infinity;return Math.ceil((ms-Date.now())/86400000)}',
  'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}',
  'function tq(s){return (LANG==="fa")?s:({"نمای کلی":"Overview","کاربران":"Users","نقاط اتصال":"Endpoints","تنظیمات":"Settings","شبکه":"Network","تلگرام":"Telegram","گزارش‌ها":"Logs","پشتیبان":"Backup","راهنما":"Help"}[s]||s)}',

  'function go(tab){TAB=tab;var ns=document.querySelectorAll(".nav button");for(var i=0;i<ns.length;i++){ns[i].classList.toggle("active",ns[i].dataset.tab===tab)}',
  '  var ps=document.querySelectorAll(".page");for(var j=0;j<ps.length;j++){ps[j].classList.toggle("hide",ps[j].id!=="page-"+tab)}',
  '  window.scrollTo(0,0); if(tab==="users")renderUsers(); if(tab==="logs")renderLogs();',
  '}',

  'async function load(){var r=await jget("/state");if(!r.ok){toast(r.error||"خطا در دریافت وضعیت");return}',
  '  S=r; LANG=r.settings.lang||"fa"; document.documentElement.lang=LANG; document.documentElement.dir=(LANG==="fa"?"rtl":"ltr");',
  '  renderOverview(); renderSettings(); renderNetwork(); renderTelegram();',
  '  if($("sc-host")&&!$("sc-host").value&&r.settings.scanProbeHost)$("sc-host").value=r.settings.scanProbeHost;',
  '  if($("sc-timeout")&&r.settings.scanTimeout)$("sc-timeout").value=r.settings.scanTimeout;',
  '  if($("sc-conc")&&r.settings.scanConcurrency)$("sc-conc").value=r.settings.scanConcurrency;',
  '  if(TAB==="users")renderUsers(); if(TAB==="logs")renderLogs(); if(TAB==="endpoints")renderEndpoints();',
  '}',

  'function statCard(label,value,hint,pct){',
  '  var d=el("div","card stat");d.appendChild(el("div","label",label));d.appendChild(el("div","value",value));',
  '  if(hint)d.appendChild(el("div","hint",hint));',
  '  if(pct!=null){var b=el("div","bar"),i=el("i");i.style.width=pct+"%";b.appendChild(i);d.appendChild(b)}',
  '  return d;}',

  'function renderOverview(){var c=$("ov-stats");c.innerHTML="";',
  '  var u=S.users||[],used=0,quota=0,active=0;',
  '  for(var i=0;i<u.length;i++){used+=u[i].used;quota+=u[i].quota;',
  '    var dl=daysLeft(u[i].expireAt);',
  '    if(u[i].enabled&&dl>0&&!(u[i].quota>0&&u[i].used>=u[i].quota))active++;}',
  '  c.appendChild(statCard("👥 کاربران",u.length,active+" فعال",null));',
  '  c.appendChild(statCard("📊 مصرف کل",fmtBytes(used),"کل تاریخچه",null));',
  '  c.appendChild(statCard("🎯 سهمیه کل",quota?fmtBytes(quota):"نامحدود","",quota?Math.round(used/quota*100):null));',
  '  c.appendChild(statCard("📡 پروتکل",String(S.settings.protocol).toUpperCase(),S.settings.killSwitch?"🛑 متوقف":"🟢 در حال کار",null));',
  '  var f=$("ov-info");f.innerHTML="";',
  '  [["میزبان",S.host],["مسیر مخفی","/"+S.settings.route],["پورت‌ها",(S.settings.ports||[]).join(", ")],',
  '   ["IP تمیز",(S.settings.cleanIPs||[]).length+" مورد"],["خروجی",S.settings.outMode],["نسخه","v"+S.version],',
  '   ["تلگرام",S.settings.tgEnabled?"فعال":"غیرفعال"]].forEach(function(p){',
  '    var d=el("div","kv");d.appendChild(el("span",null,p[0]));var b=el("b");b.textContent=p[1];d.appendChild(b);f.appendChild(d);});',
  '}',

  'function renderUsers(){var tb=$("users-body");tb.innerHTML="";',
  '  var u=S.users||[];if(!u.length){$("users-empty").classList.remove("hide");return}else{$("users-empty").classList.add("hide")}',
  '  var q=($("user-search").value||"").toLowerCase();',
  '  for(var i=0;i<u.length;i++){var x=u[i];',
  '    if(q&&(x.name||"").toLowerCase().indexOf(q)<0&&(x.id||"").toLowerCase().indexOf(q)<0)continue;',
  '    var pct=x.quota?Math.min(100,Math.round(x.used/x.quota*100)):0;',
  '    var dl=daysLeft(x.expireAt);',
  '    var alive=x.enabled&&dl>0&&!(x.quota>0&&x.used>=x.quota);',
  '    var tr=el("tr");',
  '    var td0=el("td");td0.appendChild(el("div",null,x.name));',
  '    var sm=el("div","muted mono ellipsis");sm.textContent=x.id;td0.appendChild(sm);tr.appendChild(td0);',
  '    var td1=el("td");td1.appendChild(el("div",null,fmtBytes(x.used)+(x.quota?" / "+fmtBytes(x.quota):" / ∞")));',
  '    var b=el("div","bar"),bi=el("i");bi.style.width=pct+"%";b.appendChild(bi);td1.appendChild(b);tr.appendChild(td1);',
  '    var td2=el("td");td2.textContent=x.expireAt?(dl>0?dl+" روز":"منقضی"):"∞";tr.appendChild(td2);',
  '    var td3=el("td");var p=el("span","pill "+(alive?"ok":"bad"));p.textContent=alive?"فعال":(x.enabled?(dl<=0?"منقضی":"تمام‌شده"):"غیرفعال");td3.appendChild(p);tr.appendChild(td3);',
  '    var td4=el("td");',
  '    [["لینک",function(){showLink(x)}],["QR",function(){showQR(x)}],["ویرایش",function(){editUser(x)}],',
  '     ["♻️",function(){resetUser(x)}],["🗑",function(){delUser(x)}]].forEach(function(a){',
  '      var btn=el("button","btn sm ghost");btn.textContent=a[0];btn.onclick=a[1];td4.appendChild(btn);td4.appendChild(document.createTextNode(" "));});',
  '    tr.appendChild(td4);tb.appendChild(tr);',
  '  }}',

  'async function showLink(x){',
  '  var r=await jget("/link/"+x.id);if(!r.ok)return;',
  '  openModal("لینک اشتراک · "+x.name,',
  '   "<div class=\\"linkbox\\"><input id=\\"ml\\" class=\\"mono\\" value=\\""+esc(r.url)+"\\" readonly>"+',
  '   "<button class=\\"btn sm\\" onclick=\\"var e=document.getElementById(\'ml\');e.select();navigator.clipboard.writeText(e.value)\\">کپی</button></div>"+',
  '   "<div class=\\"muted\\" style=\\"margin-top:10px\\">قالب‌ها:</div>"+',
  '   "<div class=\\"tabs\\"><a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"\\">Base64</a>"+',
  '   "<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"?format=clash\\">Clash</a>"+',
  '   "<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"?format=singbox\\">Sing-box</a>"+',
  '   "<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"?page=1\\">صفحه وضعیت</a></div>");}',

  'async function showQR(x){var r=await jget("/qr/"+x.id);if(!r.ok)return;',
  '  openModal("کد QR · "+x.name,"<div style=\\"text-align:center\\"><div class=\\"qrbox\\"><img src=\\""+r.qr+"\\" alt=\\"QR\\"></div>"+',
  '   "<div class=\\"muted\\" style=\\"margin-top:10px\\">"+esc(x.name)+"</div></div>");}',

  'function userForm(u){var isNew=!u;u=u||{name:"",quota:"",expireDays:"",deviceLimit:0,note:""};',
  '  return "<label>نام کاربر</label><input id=\\"f-name\\" value=\\""+esc(u.name)+"\\">"',
  '  +"<div class=\\"row row2\\"><div><label>سهمیه (مثال: 30GB)</label><input id=\\"f-quota\\" value=\\""+esc(u.quota||"")+"\\" placeholder=\\"نامحدود\\"></div>"',
  '  +"<div><label>انقضا (روز)</label><input id=\\"f-days\\" type=\\"number\\" value=\\""+(u.expireDays||"")+"\\" placeholder=\\"0 = بدون انقضا\\"></div></div>"',
  '  +"<label>محدودیت دستگاه (۰ = نامحدود)</label><input id=\\"f-dev\\" type=\\"number\\" value=\\""+(u.deviceLimit||0)+"\\">"',
  '  +"<label>یادداشت</label><input id=\\"f-note\\" value=\\""+esc(u.note||"")+"\\">";}',

  'function addUser(){openModal("افزودن کاربر",userForm(null),[["ایجاد",function(){saveUser(null)}]])}',
  'function editUser(x){openModal("ویرایش "+x.name,userForm(x),[["ذخیره",function(){saveUser(x.id)}]])}',
  'async function saveUser(id){',
  '  var d={name:$("f-name").value,quota:$("f-quota").value,expireDays:Number($("f-days").value||0),',
  '         deviceLimit:Number($("f-dev").value||0),note:$("f-note").value};',
  '  if(!d.name){toast("نام الزامی است");return}',
  '  var r=await jpost("/users/"+(id?"update":"create"),id?Object.assign({id:id},d):d);',
  '  if(r.ok){closeModal();toast("ذخیره شد");await load();go("users")}}',
  'async function delUser(x){if(!confirm("حذف «"+x.name+"»؟"))return;',
  '  var r=await jpost("/users/delete",{id:x.id});if(r.ok){toast("حذف شد");await load();}}',
  'async function resetUser(x){if(!confirm("صفر کردن مصرف «"+x.name+"»؟"))return;',
  '  var r=await jpost("/users/reset",{id:x.id});if(r.ok){toast("مصرف صفر شد");await load();}}',

  'function renderEndpoints(){var c=$("ep-body");if(!c)return;c.innerHTML="";',
  '  var u=S.users||[];if(!u.length){c.innerHTML="<div class=\\"empty\\">ابتدا یک کاربر بسازید</div>";return}',
  '  var sel=$("ep-user");if(sel&&sel.options.length!==u.length){sel.innerHTML="";',
  '    for(var i=0;i<u.length;i++){var o=document.createElement("option");o.value=u[i].id;o.textContent=u[i].name;sel.appendChild(o)}}',
  '  drawEndpoints();}',
  'async function drawEndpoints(){var c=$("ep-body");var id=$("ep-user").value;',
  '  var r=await jget("/link/"+id);if(!r.ok)return;',
  '  var qr=await jget("/qr/"+id);',
  '  c.innerHTML="<div class=\\"qrrow\\"><div class=\\"qrbox\\"><img src=\\""+(qr.qr||"")+"\\" alt=\\"QR\\"></div>"+',
  '   "<div style=\\"flex:1;min-width:240px\\">"',
  '   +"<div class=\\"linkbox\\"><input id=\\"ep-url\\" class=\\"mono\\" readonly value=\\""+esc(r.url)+"\\">"',
  '   +"<button class=\\"btn sm\\" onclick=\\"var e=document.getElementById(\'ep-url\');e.select();navigator.clipboard.writeText(e.value)\\">کپی</button></div>"',
  '   +"<div class=\\"tabs\\" style=\\"margin-top:10px\\">"',
  '   +"<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"\\">Base64</a>"',
  '   +"<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"?format=clash\\">Clash</a>"',
  '   +"<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"?format=singbox\\">Sing-box</a>"',
  '   +"<a class=\\"btn sm ghost\\" target=\\"_blank\\" href=\\""+esc(r.url)+"?format=raw\\">متن خام</a>"',
  '   +"</div><div class=\\"muted\\" style=\\"margin-top:8px\\">تعداد نودها: "+r.count+"</div>"',
  '   +"</div></div>";}',

  'function sw(id,label,checked){return "<div class=\\"switch\\"><span>"+label+"</span>"+',
  '  "<button class=\\"toggle "+(checked?"on":"")+"\\" id=\\""+id+"\\" onclick=\\"this.classList.toggle(\'on\')\\"></button></div>"}',
  'function swv(id){var e=$(id);return e?e.classList.contains("on"):false}',

  'function renderSettings(){var s=S.settings,c=$("set-body");if(c.dataset.built)return;c.dataset.built="1";',
  '  c.innerHTML='
  + ' "<label>مسیر مخفی</label><input id=\\"s-route\\" value=\\""+esc(s.route)+"\\"><div class=\\"muted\\">پس از تغییر، آدرس پنل عوض می‌شود.</div>"'
  + ' +"<label>پروتکل</label><select id=\\"s-proto\\"><option value=\\"vless\\">VLESS</option><option value=\\"trojan\\">Trojan</option><option value=\\"both\\">هر دو</option></select>"'
  + ' +"<div class=\\"row row2\\"><div><label>میزبان کانفیگ</label><input id=\\"s-host\\" value=\\""+esc(s.host||"")+"\\" placeholder=\\"خالی = خودکار\\"></div>"'
  + ' +"<div><label>SNI</label><input id=\\"s-sni\\" value=\\""+esc(s.sni||"")+"\\" placeholder=\\"خالی = میزبان\\"></div></div>"'
  + ' +"<label>پورت‌ها (با کاما)</label><input id=\\"s-ports\\" value=\\""+esc((s.ports||[]).join(","))+"\\">"'
  + ' +"<label>قالب نام نود</label><input id=\\"s-naming\\" value=\\""+esc(s.naming||"")+"\\">"'
  + ' +"<div class=\\"muted\\">متغیرها: {FLAG} {CITY} {COUNTRY} {PROTO} {NUM} {NAME} {HOST} {DATE}</div>"'
  + ' +"<div style=\\"margin-top:12px\\">"+sw("s-tls","TLS",s.tls)+sw("s-ech","ECH (Encrypted Client Hello)",s.ech)'
  + '  +sw("s-insecure","نپذیرفتن گواهی",s.allowInsecure)+sw("s-multi","چندکاربره",s.multiUser)'
  + '  +sw("s-autodisable","غیرفعال‌سازی خودکار",s.autoDisable)+sw("s-kill","🛑 کیل‌سوئیچ",s.killSwitch)+"</div>"'
  + ' +"<label>آدرس استتار</label><input id=\\"s-disguise\\" value=\\""+esc(s.disguiseUrl||"")+"\\">"'
  + ' +"<div style=\\"margin-top:14px\\"><button class=\\"btn primary\\" onclick=\\"saveSettings()\\">ذخیره تنظیمات</button></div>";',
  '  $("s-proto").value=s.protocol;}',

  'async function saveSettings(){',
  '  var s=S.settings;',
  '  var d={route:$("s-route").value.replace(/^\\/+|\\/+$/g,"")||s.route,protocol:$("s-proto").value,',
  '   host:$("s-host").value.trim(),sni:$("s-sni").value.trim(),',
  '   ports:($("s-ports").value||"").split(",").map(function(x){return parseInt(x.trim(),10)}).filter(function(x){return x>0&&x<65536}),',
  '   naming:$("s-naming").value,tls:swv("s-tls"),ech:swv("s-ech"),allowInsecure:swv("s-insecure"),',
  '   multiUser:swv("s-multi"),autoDisable:swv("s-autodisable"),killSwitch:swv("s-kill"),',
  '   disguiseUrl:$("s-disguise").value.trim()};',
  '  var r=await jpost("/settings",d);',
  '  if(r.ok){toast("تنظیمات ذخیره شد");if(r.route&&r.route!==s.route){setTimeout(function(){location.href="/"+r.route+"/dash"},900)}else{await load()}}}',

  'function renderNetwork(){var s=S.settings,c=$("net-body");if(c.dataset.built)return;c.dataset.built="1";',
  '  c.innerHTML='
  + ' "<label>آی‌پی‌های تمیز (هر خط: 1.1.1.1#آلمان)</label><textarea id=\\"n-clean\\">"+esc((s.cleanIPs||[]).map(function(x){return typeof x==="string"?x:(x.ip+(x.name?"#"+x.name:""))}).join("\\n"))+"</textarea>"'
  + ' +"<label>حالت خروجی</label><select id=\\"n-out\\"><option value=\\"direct\\">مستقیم</option><option value=\\"proxyip\\">ProxyIP</option><option value=\\"socks5\\">SOCKS5</option></select>"'
  + ' +"<label>ProxyIP (host:port)</label><input id=\\"n-proxy\\" value=\\""+esc(s.proxyIP||"")+"\\">"'
  + ' +"<label>SOCKS5 (user:pass@host:port)</label><input id=\\"n-socks\\" value=\\""+esc(s.socks5||"")+"\\">"'
  + ' +"<label>DNS over HTTPS</label><input id=\\"n-doh\\" value=\\""+esc(s.doh||"")+"\\">"'
  + ' +"<div style=\\"margin-top:12px\\">"+sw("n-udp","پشتیبانی UDP/DNS",s.udp)+sw("n-frag","فعال‌سازی Fragment",(s.fragment||{}).enabled)+"</div>"'
  + ' +"<div class=\\"row row2\\"><div><label>طول Fragment</label><input id=\\"n-flen\\" type=\\"number\\" value=\\""+((s.fragment||{}).length||100)+"\\"></div>"'
  + ' +"<div><label>فاصله Fragment</label><input id=\\"n-fint\\" type=\\"number\\" value=\\""+((s.fragment||{}).interval||10)+"\\"></div></div>"'
  + ' +"<div style=\\"margin-top:14px\\"><button class=\\"btn primary\\" onclick=\\"saveNetwork()\\">ذخیره شبکه</button></div>";',
  '  $("n-out").value=s.outMode||"direct";}',

  'async function saveNetwork(){',
  '  var lines=($("n-clean").value||"").split(/\\n|,/).map(function(x){return x.trim()}).filter(Boolean);',
  '  var r=await jpost("/settings",{cleanIPs:lines,outMode:$("n-out").value,proxyIP:$("n-proxy").value.trim(),',
  '   socks5:$("n-socks").value.trim(),doh:$("n-doh").value.trim(),udp:swv("n-udp"),',
  '   fragment:{enabled:swv("n-frag"),length:Number($("n-flen").value||100),interval:Number($("n-fint").value||10)}});',
  '  if(r.ok){toast("تنظیمات شبکه ذخیره شد");await load()}}',

  'function renderTelegram(){var s=S.settings,c=$("tg-body");if(c.dataset.built)return;c.dataset.built="1";',
  '  c.innerHTML='
  + ' "<div>"+sw("tg-on","فعال‌سازی ربات",s.tgEnabled)+"</div>"'
  + ' +"<label>توکن ربات</label><input id=\\"tg-token\\" value=\\""+esc(s.tgToken||"")+"\\" placeholder=\\"123456:ABC...\\">"'
  + ' +"<label>Chat ID</label><input id=\\"tg-chat\\" value=\\""+esc(s.tgChatId||"")+"\\">"'
  + ' +"<div class=\\"muted\\">دستورات: /status /users /add /del /reset /link /pause /resume</div>"'
  + ' +"<div style=\\"margin-top:14px;display:flex;gap:8px;flex-wrap:wrap\\">"'
  + ' +"<button class=\\"btn primary\\" onclick=\\"saveTelegram()\\">ذخیره</button>"'
  + ' +"<button class=\\"btn ghost\\" onclick=\\"tgTest()\\">ارسال پیام آزمایشی</button>"'
  + ' +"<button class=\\"btn ghost\\" onclick=\\"tgHook()\\">تنظیم وب‌هوک</button></div>";}',

  'async function saveTelegram(){',
  '  var r=await jpost("/settings",{tgEnabled:swv("tg-on"),tgToken:$("tg-token").value.trim(),tgChatId:$("tg-chat").value.trim()});',
  '  if(r.ok){toast("تنظیمات تلگرام ذخیره شد");await load()}}',
  'async function tgTest(){var r=await jpost("/telegram/test");if(r.ok)toast("پیام ارسال شد")}',
  'async function tgHook(){var r=await jpost("/telegram/webhook");if(r.ok)toast(r.description||"وب‌هوک تنظیم شد")}',

  'async function renderLogs(){var r=await jget("/logs");var c=$("log-body");c.innerHTML="";',
  '  var items=(r.logs||[]);if(!items.length){c.innerHTML="<div class=\\"empty\\">گزارشی ثبت نشده</div>";return}',
  '  for(var i=0;i<items.length;i++){var L=items[i];',
  '    var d=el("div","logline");var t=new Date(L.ts).toLocaleString("fa-IR");',
  '    d.appendChild(el("span","muted",t+" · "));',
  '    var s=el("span");s.style.color=L.level==="error"?"#f87171":(L.level==="warn"?"#fbbf24":"#a99e86");',
  '    s.textContent="["+L.level+"] ";d.appendChild(s);',
  '    d.appendChild(document.createTextNode(L.message));c.appendChild(d);}}',

  'var SC={running:false,ips:[],results:[],done:0,total:0};',
  'function scSorted(){return SC.results.slice().sort(function(a,b){',
  '  if(a.ok!==b.ok)return a.ok?-1:1;',
  '  return (Number(a.ms)||99999)-(Number(b.ms)||99999);});}',
  'function scSelected(){var out=[],bs=document.querySelectorAll(".sc-chk");',
  '  for(var i=0;i<bs.length;i++){if(bs[i].checked)out.push(bs[i].value);}return out;}',
  'function renderScanRows(){var tb=$("sc-body");if(!tb)return;tb.innerHTML="";',
  '  var rows=scSorted();',
  '  $("sc-empty").classList.toggle("hide",rows.length>0);',
  '  for(var i=0;i<rows.length;i++){var x=rows[i];var tr=el("tr");',
  '    var td0=el("td");',
  '    if(x.ok){var cb=document.createElement("input");cb.type="checkbox";cb.className="sc-chk";',
  '      cb.value=x.ip;cb.checked=true;cb.style.width="16px";td0.appendChild(cb);}',
  '    tr.appendChild(td0);',
  '    var td1=el("td","mono");td1.textContent=x.ip;tr.appendChild(td1);',
  '    var td2=el("td");td2.textContent=x.colo||"—";tr.appendChild(td2);',
  '    var td3=el("td");td3.textContent=x.loc||"—";tr.appendChild(td3);',
  '    var td4=el("td");td4.textContent=x.ms?x.ms+" ms":"—";tr.appendChild(td4);',
  '    var td5=el("td","muted");td5.textContent=x.tls||"—";tr.appendChild(td5);',
  '    var td6=el("td");var p=el("span","pill "+(x.ok?"ok":"bad"));',
  '      p.textContent=x.ok?"سالم":(x.error||"ناموفق");td6.appendChild(p);tr.appendChild(td6);',
  '    tb.appendChild(tr);}}',
  'function updateScanProgress(){var c=$("sc-progress");if(!c)return;',
  '  if(!SC.total){c.innerHTML="";return}',
  '  var pct=Math.round(SC.done/SC.total*100);',
  '  var okc=SC.results.filter(function(x){return x.ok}).length;',
  '  c.innerHTML="";',
  '  var top=el("div");top.style.display="flex";top.style.justifyContent="space-between";',
  '  top.style.fontSize="12px";top.style.color="var(--muted)";',
  '  top.appendChild(el("span",null,SC.done+" / "+SC.total));',
  '  top.appendChild(el("span",null,okc+" آی‌پی سالم"+(SC.running?"":" · پایان")));',
  '  c.appendChild(top);',
  '  var bar=el("div","bar"),fill=el("i");fill.style.width=pct+"%";bar.appendChild(fill);',
  '  c.appendChild(bar);}',
  'async function startScan(){',
  '  if(SC.running){toast("اسکن در حال اجراست");return}',
  '  var count=Number($("sc-count").value||100);',
  '  SC.running=true;SC.results=[];SC.done=0;SC.total=0;',
  '  renderScanRows();updateScanProgress();',
  '  var r=await jpost("/scan/candidates",{count:count,mode:$("sc-mode").value});',
  '  if(!r.ok){SC.running=false;return}',
  '  SC.ips=r.ips||[];SC.total=SC.ips.length;updateScanProgress();',
  '  while(SC.running&&SC.done<SC.total){',
  '    var chunk=SC.ips.slice(SC.done,SC.done+20);',
  '    var pr=await jpost("/scan/probe",{ips:chunk,',
  '      timeout:Number($("sc-timeout").value||2500),',
  '      concurrency:Number($("sc-conc").value||8),',
  '      probeHost:($("sc-host").value||"").trim()});',
  '    if(pr.ok&&pr.results)SC.results=SC.results.concat(pr.results);',
  '    SC.done+=chunk.length;',
  '    renderScanRows();updateScanProgress();',
  '    await new Promise(function(res){setTimeout(res,80)});',
  '  }',
  '  SC.running=false;updateScanProgress();',
  '  var okc=SC.results.filter(function(x){return x.ok}).length;',
  '  toast("پایان اسکن: "+okc+" آی‌پی سالم از "+SC.results.length);}',
  'function stopScan(){SC.running=false;toast("پس از این دسته متوقف می‌شود")}',
  'async function loadScanCache(){var r=await jget("/scan/cache");if(!r.ok)return;',
  '  SC.results=r.items||[];SC.done=SC.results.length;SC.total=SC.results.length;',
  '  renderScanRows();updateScanProgress();toast("بارگیری شد: "+SC.results.length+" رکورد")}',
  'async function clearScan(){if(!confirm("نتایج ذخیره‌شده پاک شود؟"))return;',
  '  var r=await jpost("/scan/clear");if(r.ok){SC.results=[];SC.done=0;SC.total=0;',
  '    renderScanRows();updateScanProgress();toast("پاک شد")}}',
  'async function applyScan(){var sel=scSelected();',
  '  if(!sel.length){toast("هیچ آی‌پی‌ای انتخاب نشده است");return}',
  '  var top=Number($("sc-top").value||0);var chosen=sel;',
  '  if(top>0){chosen=scSorted().filter(function(x){return sel.indexOf(x.ip)>=0})',
  '    .slice(0,top).map(function(x){return x.ip});}',
  '  var r=await jpost("/scan/apply",{ips:chosen,replace:true});',
  '  if(r.ok){toast("اعمال شد: "+r.count+" آی‌پی");await load()}}',
  'async function doExport(){var r=await jget("/backup/export");',
  '  var b=new Blob([JSON.stringify(r,null,2)],{type:"application/json"});var a=document.createElement("a");',
  '  a.href=URL.createObjectURL(b);a.download="takht-e-jamshid-backup.json";a.click();toast("خروجی گرفته شد")}',
  'async function doImport(file){var txt=await file.text();',
  '  var r=await jpost("/backup/import",JSON.parse(txt));if(r.ok){toast("بازیابی انجام شد");await load()}}',

  'function openModal(title,html,buttons){$("m-title").textContent=title;$("m-body").innerHTML=html;',
  '  var f=$("m-foot");f.innerHTML="";',
  '  (buttons||[["بستن",closeModal]]).forEach(function(b){var btn=el("button","btn "+(b[2]?"":"primary"));btn.textContent=b[0];btn.onclick=b[1];f.appendChild(btn)});',
  '  $("mask").classList.add("show")}',
  'function closeModal(){$("mask").classList.remove("show")}',

  'function changePass(){openModal("تغییر گذرواژه",',
  '  "<label>گذرواژه جدید</label><input id=\\"p1\\" type=\\"password\\">"',
  '  +"<label>تکرار گذرواژه</label><input id=\\"p2\\" type=\\"password\\">",',
  '  [["بستن",closeModal],["تغییر",async function(){',
  '    if($("p1").value.length<4){toast("حداقل ۴ کاراکتر");return}',
  '    if($("p1").value!==$("p2").value){toast("تکرار برابر نیست");return}',
  '    var r=await jpost("/password",{password:$("p1").value});',
  '    if(r.ok){closeModal();toast("گذرواژه تغییر کرد")}}]]);}',

  'function toggleTheme(){document.body.classList.toggle("light");THEME=document.body.classList.contains("light")?"light":"dark";',
  '  jpost("/settings",{theme:THEME})}',
  'async function toggleLang(){var l=(S.settings.lang==="fa")?"en":"fa";var r=await jpost("/settings",{lang:l});',
  '  if(r.ok){location.reload()}}',

  'window.addEventListener("DOMContentLoaded",function(){',
  '  var ns=document.querySelectorAll(".nav button");',
  '  for(var i=0;i<ns.length;i++){ns[i].onclick=function(){go(this.dataset.tab)}}',
  '  load();});',
].join('\n');

function renderPanel(state) {
  const s = state.settings;
  const lang = s.lang || 'fa';
  const rtl = lang !== 'en';
  const route = s.route;
  const js = CLIENT_JS.replace(/__ROUTE__/g, route);

  const nav = [
    ['overview', '🏛️', 'نمای کلی'],
    ['users', '👥', 'کاربران'],
    ['scanner', '🎯', 'اسکنر آی‌پی'],
    ['endpoints', '🔗', 'نقاط اتصال'],
    ['settings', '⚙️', 'تنظیمات'],
    ['network', '🌐', 'شبکه'],
    ['telegram', '✈️', 'تلگرام'],
    ['logs', '📜', 'گزارش‌ها'],
    ['backup', '💾', 'پشتیبان'],
    ['help', '❓', 'راهنما'],
  ];

  let navHtml = '';
  for (const n of nav) {
    navHtml += '<button data-tab="' + n[0] + '" class="' + (n[0] === 'overview' ? 'active' : '') + '">'
      + '<span>' + n[1] + '</span><span>' + n[2] + '</span></button>';
    if (n[0] === 'endpoints' || n[0] === 'telegram') navHtml += '<div class="sep"></div>';
  }

  const helpHtml = [
    '<div class="card"><h3>⁉️ پرسش‌های پرتکرار</h3>',
    '<div class="kv"><span>چرا صفحه اصلی چیزی نشان نمی‌دهد؟</span><b>استتار است؛ پنل در /' + route + '/dash است</b></div>',
    '<div class="kv"><span>خطای DB missing</span><b>اتصال D1 با نام DB را بسازید</b></div>',
    '<div class="kv"><span>محدودیت پلن رایگان</span><b>۱۰۰٬۰۰۰ درخواست در روز</b></div>',
    '<div class="kv"><span>UDP/VoIP</span><b>روی Workers پشتیبانی نمی‌شود</b></div>',
    '</div>',
    '<div class="card" style="margin-top:14px"><h3>📖 مسیرها</h3>',
    '<div class="kv"><span>پنل</span><b>/' + route + '/dash</b></div>',
    '<div class="kv"><span>ورودی پروکسی</span><b>/' + route + '</b></div>',
    '<div class="kv"><span>اشتراک</span><b>/' + route + '/sub/&lt;token&gt;</b></div>',
    '<div class="kv"><span>وب‌هوک تلگرام</span><b>/' + route + '/tg</b></div>',
    '</div>',
  ].join('');

  return '<!DOCTYPE html><html lang="' + (rtl ? 'fa' : 'en') + '" dir="' + (rtl ? 'rtl' : 'ltr') + '"><head>'
    + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow">'
    + '<meta name="referrer" content="no-referrer">'
    + '<title>' + PANEL_FA + ' · ' + PANEL_TAG + '</title>'
    + '<style>' + CSS + '</style></head><body>'

    + '<div class="app">'
    + '  <aside class="sidebar">'
    + '    <div class="brand">' + HERO_SVG.replace('width="228" height="86"', 'width="150" height="56"').replace('class="hero"', 'style="width:150px"') + '</div>'
    + '    <div class="frieze" style="margin:8px 0"></div>'
    + '    <div class="muted" style="font-size:10.5px;text-align:center">v' + VERSION + '</div>'
    + '    <nav class="nav">' + navHtml + '</nav>'
    + '  </aside>'

    + '  <main class="main">'
    + '    <div class="topbar">'
    + '      <div><h2>🏛️ ' + PANEL_FA + '</h2><div class="sub">' + PANEL_TAG + ' · ' + escapeHtml(state.host) + '</div></div>'
    + '      <div class="tools">'
    + '        <button class="btn ghost sm" onclick="toggleTheme()">🌓</button>'
    + '        <button class="btn ghost sm" onclick="toggleLang()">🌐 فا/En</button>'
    + '        <button class="btn ghost sm" onclick="changePass()">🔑</button>'
    + '        <a class="btn sm" href="/' + route + '/logout">خروج</a>'
    + '      </div>'
    + '    </div>'
    + '    <div class="frieze" style="margin-bottom:16px"></div>'

    + '    <section id="page-overview" class="page">'
    + '      <div class="grid g4" id="ov-stats"></div>'
    + '      <div class="grid g2" style="margin-top:14px">'
    + '        <div class="card"><h3>🧭 اطلاعات سامانه</h3><div id="ov-info"></div></div>'
    + '        <div class="card"><h3>⚡ دسترسی سریع</h3>'
    + '          <div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '            <button class="btn" onclick="addUser()">➕ افزودن کاربر</button>'
    + '            <button class="btn ghost" onclick="go(\'endpoints\')">🔗 دریافت لینک</button>'
    + '            <button class="btn ghost" onclick="load()">🔄 بروزرسانی</button>'
    + '          </div>'
    + '          <div class="muted" style="margin-top:14px">تخت جمشید روی لبه‌ی شبکه‌ی کلودفلر اجرا می‌شود؛ نیازی به سرور نیست.</div>'
    + '        </div>'
    + '      </div>'
    + '    </section>'

    + '    <section id="page-users" class="page hide">'
    + '      <div class="card">'
    + '        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + '          <h3 style="margin:0">👥 کاربران</h3>'
    + '          <div style="display:flex;gap:8px"><input id="user-search" placeholder="جستجو…" style="width:180px" oninput="renderUsers()">'
    + '          <button class="btn primary" onclick="addUser()">➕ افزودن</button></div>'
    + '        </div>'
    + '        <div class="table-wrap"><table><thead><tr>'
    + '          <th>نام</th><th>مصرف</th><th>انقضا</th><th>وضعیت</th><th>عملیات</th>'
    + '        </tr></thead><tbody id="users-body"></tbody></table></div>'
    + '        <div class="empty hide" id="users-empty">هنوز کاربری نساخته‌اید.</div>'
    + '      </div>'
    + '    </section>'

    + '    <section id="page-endpoints" class="page hide">'
    + '      <div class="card"><h3>🔗 نقاط اتصال</h3>'
    + '        <label>انتخاب کاربر</label>'
    + '        <select id="ep-user" onchange="drawEndpoints()"></select>'
    + '        <div id="ep-body" style="margin-top:16px"></div>'
    + '      </div>'
    + '    </section>'

    + '    <section id="page-scanner" class="page hide">'
    + '      <div class="card">'
    + '        <h3>🎯 اسکنر آی‌پی تمیز</h3>'
    + '        <div class="muted" style="margin-bottom:14px">بازه‌های رسمیِ IPv4 کلودفلر نمونه‌برداری می‌شوند و برای هر آی‌پی، دیتاسنتر، کشور و زمانِ رفت‌وبرگشت از لبه اندازه‌گیری می‌گردد. سپس بهترین‌ها را مستقیماً روی کانفیگ‌ها اعمال کنید.</div>'
    + '        <div class="row row3">'
    + '          <div><label>تعداد کاندیدا</label><select id="sc-count">'
    + '            <option value="50">۵۰</option><option value="100" selected>۱۰۰</option>'
    + '            <option value="200">۲۰۰</option><option value="500">۵۰۰</option></select></div>'
    + '          <div><label>روش نمونه‌گیری</label><select id="sc-mode">'
    + '            <option value="spread">متوازن (پوشش بهتر)</option>'
    + '            <option value="random">تصادفی</option></select></div>'
    + '          <div><label>مهلت هر تست (میلی‌ثانیه)</label>'
    + '            <input id="sc-timeout" type="number" value="2500" min="500" max="10000" step="100"></div>'
    + '        </div>'
    + '        <div class="row row2">'
    + '          <div><label>میزبانِ پروب</label>'
    + '            <input id="sc-host" placeholder="خالی = خودکار (cloudflare.com)"></div>'
    + '          <div><label>تعداد اندازه‌گیریِ هم‌زمان</label>'
    + '            <input id="sc-conc" type="number" value="8" min="1" max="20"></div>'
    + '        </div>'
    + '        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'
    + '          <button class="btn primary" onclick="startScan()">🎯 شروع اسکن</button>'
    + '          <button class="btn ghost" onclick="stopScan()">⏹ توقف</button>'
    + '          <button class="btn ghost" onclick="loadScanCache()">📥 بارگیری ذخیره‌شده</button>'
    + '          <button class="btn danger" onclick="clearScan()">🗑 پاک‌سازی نتایج</button>'
    + '        </div>'
    + '        <div id="sc-progress" style="margin-top:16px"></div>'
    + '      </div>'
    + '      <div class="card" style="margin-top:14px">'
    + '        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + '          <h3 style="margin:0">📋 نتایج</h3>'
    + '          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    + '            <select id="sc-top" style="width:auto">'
    + '              <option value="5">۵ سریع‌ترین</option>'
    + '              <option value="10" selected>۱۰ سریع‌ترین</option>'
    + '              <option value="20">۲۰ سریع‌ترین</option>'
    + '              <option value="0">همه‌ی انتخاب‌شده‌ها</option></select>'
    + '            <button class="btn primary" onclick="applyScan()">اعمال روی کانفیگ‌ها</button>'
    + '          </div>'
    + '        </div>'
    + '        <div class="table-wrap"><table><thead><tr>'
    + '          <th style="width:36px"></th><th>آی‌پی</th><th>دیتاسنتر</th>'
    + '          <th>کشور</th><th>تأخیر</th><th>TLS</th><th>وضعیت</th>'
    + '        </tr></thead><tbody id="sc-body"></tbody></table></div>'
    + '        <div class="empty" id="sc-empty">هنوز اسکنی انجام نشده است.</div>'
    + '      </div>'
    + '    </section>'
    + '    <section id="page-settings" class="page hide"><div class="card"><h3>⚙️ تنظیمات</h3><div id="set-body"></div></div></section>'
    + '    <section id="page-network" class="page hide"><div class="card"><h3>🌐 شبکه و آی‌پی تمیز</h3><div id="net-body"></div></div></section>'
    + '    <section id="page-telegram" class="page hide"><div class="card"><h3>✈️ ربات تلگرام</h3><div id="tg-body"></div></div></section>'

    + '    <section id="page-logs" class="page hide">'
    + '      <div class="card"><h3>📜 گزارش‌ها</h3>'
    + '        <div style="display:flex;gap:8px;margin-bottom:10px">'
    + '          <button class="btn ghost sm" onclick="renderLogs()">🔄 بروزرسانی</button></div>'
    + '        <div id="log-body" style="max-height:60vh;overflow:auto"></div></div>'
    + '    </section>'

    + '    <section id="page-backup" class="page hide">'
    + '      <div class="card"><h3>💾 پشتیبان و بازیابی</h3>'
    + '        <div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '          <button class="btn primary" onclick="doExport()">خروجی JSON</button>'
    + '          <label class="btn ghost" style="cursor:pointer">بازیابی فایل<input type="file" accept="application/json" style="display:none" onchange="doImport(this.files[0])"></label>'
    + '        </div>'
    + '        <div class="muted" style="margin-top:12px">فایل پشتیبان شامل تنظیمات و کاربران است. بازیابی، کاربران فعلی را جایگزین می‌کند.</div>'
    + '      </div>'
    + '    </section>'

    + '    <section id="page-help" class="page hide"><div class="grid g2">' + helpHtml + '</div></section>'
    + '  </main>'
    + '</div>'

    + '<div class="mask" id="mask" onclick="if(event.target===this)closeModal()">'
    + '  <div class="modal"><h3 id="m-title"></h3><div id="m-body"></div><div class="modal-foot" id="m-foot"></div></div>'
    + '</div>'
    + '<div class="toast" id="toast"></div>'
    + '<script>' + js + '</script>'
    + '</body></html>';
}

/* صفحه استتار — چیزی که بازدیدکننده‌ی ناشناس می‌بیند */
function renderDisguise() {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow">'
    + '<title>Persepolis · Achaemenid Heritage Archive</title>'
    + '<style>' + CSS + 'body{display:flex;align-items:center;justify-content:center;padding:30px}'
    + '.doc{max-width:720px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:30px}'
    + '.doc h1{font-size:20px;margin:14px 0 6px;color:var(--gold-2)}'
    + '.doc p{color:var(--muted);font-size:13.5px;line-height:1.9}'
    + '.doc .meta{font-size:11.5px;color:var(--muted);margin-top:18px;border-top:1px dashed var(--line);padding-top:12px}'
    + '</style></head><body>'
    + '<div class="doc">' + HERO_SVG
    + '<h1>Persepolis — Achaemenid Ceremonial Capital</h1>'
    + '<p>Persepolis was the ceremonial capital of the Achaemenid Empire, founded by Darius I in 518 BCE. '
    + 'The terrace, its apadana, gate of all nations and columned halls, were raised by successive kings '
    + 'and remained a symbol of imperial order for nearly two centuries.</p>'
    + '<p>This archive page is a static placeholder. Nothing here is interactive, and no visitor data is collected or stored.</p>'
    + '<div class="meta">Public domain reference material · Static archive placeholder</div>'
    + '</div></body></html>';
}

/* ---------- 09_api.js ------------------------------------------------- */
/* ==========================================================================
   09_api.js — احراز هویت و API پنل
   ========================================================================== */

const COOKIE = 'tj_sid';
const SESSION_TTL = 12 * 3600 * 1000;   // ۱۲ ساعت

async function sessionSecret(settings) {
  return (settings.passSalt || 'takht') + ':' + (settings.panelPassHash || '');
}

async function makeSession(settings, username) {
  const payload = { u: username, exp: nowMs() + SESSION_TTL };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacSha256(new TextEncoder().encode(await sessionSecret(settings)), body);
  return body + '.' + sig;
}

async function verifySession(request, settings) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)tj_sid=([^;]+)/);
  if (!m) return false;
  const token = decodeURIComponent(m[1]);
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const expect = await hmacSha256(new TextEncoder().encode(await sessionSecret(settings)), parts[0]);
  if (expect !== parts[1]) return false;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))); } catch (e) { return false; }
  if (!payload || !payload.exp || payload.exp < nowMs()) return false;
  return true;
}

function setSessionCookie(value) {
  return COOKIE + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + Math.floor(SESSION_TTL / 1000);
}

async function checkPassword(settings, password, env) {
  if (!settings.panelPassHash) {
    const boot = String((env && env.PANEL_PASS) || '').trim() || 'admin';
    return String(password) === boot;
  }
  const hash = await sha256(String(password) + (settings.passSalt || ''), true);
  return hash === settings.panelPassHash;
}

/* تنظیماتی که برای کلاینت امن است */
function publicSettings(s) {
  return {
    route: s.route, protocol: s.protocol, host: s.host, sni: s.sni,
    ports: s.ports, tls: s.tls, ech: s.ech, allowInsecure: s.allowInsecure,
    cleanIPs: s.cleanIPs, outMode: s.outMode, proxyIP: s.proxyIP, socks5: s.socks5,
    doh: s.doh, udp: s.udp, fragment: s.fragment, multiUser: s.multiUser,
    autoDisable: s.autoDisable, killSwitch: s.killSwitch, naming: s.naming,
    disguiseUrl: s.disguiseUrl, tgEnabled: s.tgEnabled, tgToken: s.tgToken,
    tgChatId: s.tgChatId, lang: s.lang, theme: s.theme,
    scanProbeHost: s.scanProbeHost, scanTimeout: s.scanTimeout, scanConcurrency: s.scanConcurrency,
  };
}

/* ---------------------------- پاسخ‌های API ---------------------------- */

async function apiState(env, settings, hostInfo) {
  const users = await listUsers(env);
  return jsonResponse({
    ok: true,
    version: VERSION,
    host: hostInfo.host,
    base: hostInfo.proto + '://' + hostInfo.hostHeader,
    settings: publicSettings(settings),
    users: users.map(u => ({
      id: u.id, name: u.name, uuid: u.uuid, trojanPass: u.trojanPass,
      used: u.used, quota: u.quota,
      expireAt: u.expireAt, enabled: u.enabled, deviceLimit: u.deviceLimit, note: u.note,
    })),
  });
}

async function apiSaveSettings(env, settings, patch, ctx) {
  if (patch.route !== undefined) {
    const r = String(patch.route).replace(/^\/+|\/+$/g, '');
    if (!r || !/^[a-z0-9][a-z0-9\-_]{1,31}$/i.test(r)) {
      return jsonResponse({ ok: false, error: 'مسیر نامعتبر است' }, 400);
    }
    settings.route = r;
  }
  const allowed = [
    'protocol', 'host', 'sni', 'ports', 'naming', 'tls', 'ech', 'allowInsecure',
    'multiUser', 'autoDisable', 'killSwitch', 'disguiseUrl', 'cleanIPs', 'outMode',
    'proxyIP', 'socks5', 'doh', 'udp', 'fragment', 'tgEnabled', 'tgToken', 'tgChatId',
    'lang', 'theme', 'blockAds', 'blockPorn', 'startOnFirstUse', 'nodePrefix',
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) settings[k] = patch[k];
  }
  if (settings.protocol !== 'vless' && settings.protocol !== 'trojan' && settings.protocol !== 'both') {
    settings.protocol = 'both';
  }
  if (!Array.isArray(settings.ports) || !settings.ports.length) settings.ports = [443];
  settings.ports = settings.ports.map(p => clamp(Number(p) || 443, 1, 65535));
  await saveSettings(env, settings);
  await addLog(env, 'info', 'تنظیمات به‌روزرسانی شد', 'panel');
  return jsonResponse({ ok: true, route: settings.route });
}

async function apiUsers(env, settings, action, body, ctx) {
  switch (action) {
    case 'create': {
      const u = await createUser(env, {
        name: body.name, quota: body.quota, expireDays: body.expireDays,
        deviceLimit: body.deviceLimit, note: body.note, enabled: true,
      });
      await addLog(env, 'info', 'کاربر جدید: ' + u.name, 'panel');
      return jsonResponse({ ok: true, user: { id: u.id, name: u.name } });
    }
    case 'update': {
      if (!body.id) return jsonResponse({ ok: false, error: 'شناسه لازم است' }, 400);
      const u = await updateUser(env, body.id, body);
      if (!u) return jsonResponse({ ok: false, error: 'کاربر پیدا نشد' }, 404);
      await addLog(env, 'info', 'ویرایش کاربر: ' + u.name, 'panel');
      return jsonResponse({ ok: true, user: { id: u.id, name: u.name } });
    }
    case 'delete': {
      await deleteUser(env, body.id);
      await addLog(env, 'warn', 'حذف کاربر', 'panel');
      return jsonResponse({ ok: true });
    }
    case 'reset': {
      await updateUser(env, body.id, { used: 0 });
      await addLog(env, 'info', 'صفر کردن مصرف', 'panel');
      return jsonResponse({ ok: true });
    }
    case 'toggle': {
      const u = await getUserById(env, body.id);
      if (!u) return jsonResponse({ ok: false, error: 'کاربر پیدا نشد' }, 404);
      await updateUser(env, body.id, { enabled: !u.enabled });
      return jsonResponse({ ok: true });
    }
    default:
      return jsonResponse({ ok: false, error: 'عملیات نامشخص' }, 400);
  }
}

async function apiLink(env, settings, userId, hostInfo) {
  const user = await getUserById(env, userId);
  if (!user) return jsonResponse({ ok: false, error: 'کاربر پیدا نشد' }, 404);
  const base = hostInfo.proto + '://' + hostInfo.hostHeader;
  const url = base + '/' + settings.route + '/sub/' + user.token;
  const nodes = buildNodesForUser(user, settings, hostInfo);
  return jsonResponse({ ok: true, url, count: nodes.length, token: user.token });
}

async function apiQr(env, settings, userId, hostInfo) {
  const user = await getUserById(env, userId);
  if (!user) return jsonResponse({ ok: false, error: 'کاربر پیدا نشد' }, 404);
  const base = hostInfo.proto + '://' + hostInfo.hostHeader;
  const url = base + '/' + settings.route + '/sub/' + user.token;
  return jsonResponse({ ok: true, qr: qrDataUri(url, { ecl: 'M', border: 2, dark: '#1b1207' }) });
}

async function apiPassword(env, settings, password) {
  if (String(password).length < 4) {
    return jsonResponse({ ok: false, error: 'گذرواژه باید حداقل ۴ کاراکتر باشد' }, 400);
  }
  settings.passSalt = randomToken(8);
  settings.panelPassHash = await sha256(String(password) + settings.passSalt, true);
  await saveSettings(env, settings);
  await addLog(env, 'warn', 'گذرواژه پنل تغییر کرد', 'panel');
  return jsonResponse({ ok: true });
}

/* --------------------------- اسکنر آی‌پی تمیز --------------------------- */

async function apiScan(env, ctx, settings, action, body, hostInfo) {
  switch (action) {
    case 'candidates': {
      const count = clamp(Number(body.count) || 100, 1, 2000);
      const ips = generateCandidates({
        count,
        mode: body.mode === 'random' ? 'random' : 'spread',
        ranges: Array.isArray(body.ranges) && body.ranges.length ? body.ranges : null,
        seed: Number(body.seed) || 0,
      });
      return jsonResponse({ ok: true, count: ips.length, ips });
    }

    case 'probe': {
      const ips = Array.isArray(body.ips) ? body.ips : [];
      if (!ips.length) return jsonResponse({ ok: false, error: 'فهرست آی‌پی خالی است' }, 400);
      const results = await probeBatch(env, settings, ips, {
        concurrency: Number(body.concurrency) || settings.scanConcurrency || 8,
        timeout: Number(body.timeout) || settings.scanTimeout || 2500,
        probeHost: String(body.probeHost || '').trim() || settings.scanProbeHost || '',
      });
      if (ctx && ctx.waitUntil) ctx.waitUntil(saveScanResults(env, results));
      else await saveScanResults(env, results);
      return jsonResponse({ ok: true, results });
    }

    case 'cache': {
      const items = await getScanCache(env, Number(body && body.limit) || 300);
      return jsonResponse({ ok: true, items });
    }

    case 'apply': {
      const ips = Array.isArray(body.ips) ? body.ips.slice(0, 128) : [];
      if (!ips.length) return jsonResponse({ ok: false, error: 'هیچ آی‌پی‌ای انتخاب نشده است' }, 400);
      const cache = await getScanCache(env, 2000);
      const map = Object.create(null);
      for (const c of cache) map[c.ip] = c;

      const entries = ips.map(ip => {
        const c = map[ip];
        return (c && c.ok) ? (ip + '#' + ipLabel(c)) : String(ip);
      });

      const merged = body.replace === false
        ? (settings.cleanIPs || []).concat(entries)
        : entries;

      // حذف تکراری‌ها بر اساس خودِ آی‌پی
      const uniq = [];
      const seen = Object.create(null);
      for (const e of merged) {
        const key = String(e).split('#')[0];
        if (seen[key]) continue;
        seen[key] = 1;
        uniq.push(e);
      }
      settings.cleanIPs = uniq.slice(0, 128);
      await saveSettings(env, settings);
      await addLog(env, 'info', 'اعمال ' + uniq.length + ' آی‌پی تمیز از اسکنر', 'panel');
      return jsonResponse({ ok: true, count: uniq.length, cleanIPs: settings.cleanIPs });
    }

    case 'clear': {
      await clearScanCache(env);
      return jsonResponse({ ok: true });
    }

    default:
      return jsonResponse({ ok: false, error: 'عملیات اسکن نامشخص' }, 400);
  }
}

async function apiTelegram(env, ctx, settings, action, hostInfo) {
  if (action === 'test') {
    const ok = await tgSend(env, settings, '🏛️ <b>تخت جمشید</b>\nپیام آزمایشی دریافت شد.');
    return jsonResponse(ok ? { ok: true } : { ok: false, error: 'ارسال ناموفق بود' });
  }
  if (action === 'webhook') {
    const base = hostInfo.proto + '://' + hostInfo.hostHeader;
    const res = await tgSetWebhook(env, settings, base + '/' + settings.route + '/tg');
    await saveSettings(env, settings);
    return jsonResponse({ ok: !!res.ok, description: res.description || (res.ok ? 'وب‌هوک تنظیم شد' : 'خطا') });
  }
  return jsonResponse({ ok: false, error: 'عملیات نامشخص' }, 400);
}

/* ---------- 10_main.js ------------------------------------------------ */
/* ==========================================================================
   10_main.js — مسیریاب اصلی و نقطه ورود Worker
   ========================================================================== */

async function ensureDefaultUser(env, settings) {
  if (!env.DB) return null;
  try {
    const users = await listUsers(env);
    if (users.length) return null;
    return await createUser(env, {
      name: 'داریوش',
      quota: '0',
      expireDays: 0,
      note: 'کاربر پیش‌فرضِ ساخته‌شده در نصب اولیه',
    });
  } catch (e) {
    return null;
  }
}

async function serveDisguise(request, settings, ctx) {
  const mode = settings.disguiseMode || 'static';
  const target = settings.disguiseUrl || DEFAULT_SETTINGS.disguiseUrl;
  if (mode === 'redirect' && target) {
    return Response.redirect(target, 302);
  }
  if (mode === 'proxy' && target) {
    try {
      const res = await fetch(target, { headers: { 'user-agent': request.headers.get('user-agent') || 'Mozilla/5.0' }, redirect: 'follow' });
      return new Response(res.body, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') || 'text/html; charset=utf-8' },
      });
    } catch (e) {
      return htmlResponse(renderDisguise());
    }
  }
  return htmlResponse(renderDisguise());
}

async function serveSubscription(request, env, ctx, settings, token, hostInfo) {
  const user = await getUserByToken(env, token);
  if (!user) return textResponse('لینک اشتراک معتبر نیست', 404);
  if (!user.enabled) return textResponse('اشتراک غیرفعال است', 403);

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'auto';

  if (url.searchParams.get('page')) {
    const base = hostInfo.proto + '://' + hostInfo.hostHeader;
    const subUrl = base + '/' + settings.route + '/sub/' + user.token;
    const nodes = buildNodesForUser(user, settings, hostInfo);
    const qr = qrDataUri(subUrl, { ecl: 'M', border: 2, dark: '#1b1207' });
    return htmlResponse(renderStatusPage(user, settings, qr, base, nodes.length));
  }

  const sub = buildSubscription(user, settings, hostInfo, format);
  const headers = Object.assign({ 'content-type': sub.type }, buildSubHeaders(user));
  return new Response(sub.body, { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const hostInfo = getHostFromRequest(request);
    const settings = await getSettings(env);
    const prefix = '/' + String(settings.route || 'takht').replace(/^\/+|\/+$/g, '');
    const upgrade = (request.headers.get('upgrade') || '').toLowerCase();

    /* هر درخواست فرصتی برای تخلیه‌ی شمارنده‌ی مصرف */
    if (ctx && ctx.waitUntil) ctx.waitUntil(flushUsage(env, false));

    /* ----------------------- وب‌هوک تلگرام ----------------------- */
    if (path === prefix + '/tg') {
      if (request.method !== 'POST') return textResponse('ok');
      const secret = request.headers.get('x-telegram-bot-api-secret-token');
      if (settings.tgSecret && secret !== settings.tgSecret) {
        return textResponse('forbidden', 403);
      }
      const update = await request.json().catch(() => null);
      if (update && ctx && ctx.waitUntil) {
        const base = hostInfo.proto + '://' + hostInfo.hostHeader;
        ctx.waitUntil(handleTelegramUpdate(env, ctx, settings, update, base));
      }
      return textResponse('ok');
    }

    /* -------------------------- اشتراک -------------------------- */
    if (path.startsWith(prefix + '/sub/')) {
      const token = path.slice((prefix + '/sub/').length).split('/')[0];
      return serveSubscription(request, env, ctx, settings, token, hostInfo);
    }

    /* --------------------------- ورود --------------------------- */
    if (path === prefix + '/login') {
      if (request.method === 'POST') {
        let form;
        try { form = await request.formData(); } catch (e) { form = null; }
        const user = form ? String(form.get('user') || '') : '';
        const pass = form ? String(form.get('pass') || '') : '';
        const okUser = user === (settings.panelUser || 'admin') || user === 'admin';
        const okPass = await checkPassword(settings, pass, env);
        if (okUser && okPass) {
          const sid = await makeSession(settings, user);
          await addLog(env, 'info', 'ورود موفق به پنل از ' + (request.headers.get('cf-connecting-ip') || 'ناشناس'), user);
          if (settings.tgEnabled && settings.tgNotifyLogin) {
            if (ctx && ctx.waitUntil) {
              ctx.waitUntil(tgSend(env, settings, '🔐 <b>ورود به تخت جمشید</b>\nکاربر: <code>' + escapeHtml(user) + '</code>\nIP: <code>' + escapeHtml(request.headers.get('cf-connecting-ip') || '?') + '</code>'));
            }
          }
          return new Response(null, {
            status: 303,
            headers: { location: prefix + '/dash', 'set-cookie': setSessionCookie(sid) },
          });
        }
        await addLog(env, 'warn', 'ورود ناموفق: ' + user, 'guest');
        return htmlResponse(renderLogin(settings.route, settings.lang, 'نام کاربری یا گذرواژه اشتباه است', hostInfo.host), 401);
      }
      return htmlResponse(renderLogin(settings.route, settings.lang, '', hostInfo.host));
    }

    if (path === prefix + '/logout') {
      return new Response(null, {
        status: 303,
        headers: { location: prefix + '/login', 'set-cookie': COOKIE + '=; Path=/; HttpOnly; Secure; Max-Age=0' },
      });
    }

    /* ---------------------------- API ---------------------------- */
    if (path.startsWith(prefix + '/api/')) {
      if (!(await verifySession(request, settings))) {
        return jsonResponse({ ok: false, error: 'نشست معتبر نیست؛ دوباره وارد شوید' }, 401);
      }
      const rest = path.slice((prefix + '/api/').length);
      const parts = rest.split('/').filter(Boolean);
      const group = parts[0] || '';

      if (request.method === 'GET' && group === 'state') return apiState(env, settings, hostInfo);
      if (request.method === 'GET' && group === 'scan' && parts[1] === 'cache') {
        return apiScan(env, ctx, settings, 'cache', {}, hostInfo);
      }
      if (request.method === 'GET' && group === 'logs') return jsonResponse({ ok: true, logs: await listLogs(env, 300) });
      if (request.method === 'GET' && group === 'link' && parts[1]) return apiLink(env, settings, parts[1], hostInfo);
      if (request.method === 'GET' && group === 'qr' && parts[1]) return apiQr(env, settings, parts[1], hostInfo);
      if (request.method === 'GET' && group === 'backup' && parts[1] === 'export') {
        return jsonResponse(await exportBackup(env));
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (group === 'settings') return apiSaveSettings(env, settings, body, ctx);
        if (group === 'users' && parts[1]) return apiUsers(env, settings, parts[1], body, ctx);
        if (group === 'scan' && parts[1]) return apiScan(env, ctx, settings, parts[1], body, hostInfo);
        if (group === 'password') return apiPassword(env, settings, body.password);
        if (group === 'telegram') return apiTelegram(env, ctx, settings, parts[1], hostInfo);
        if (group === 'backup' && parts[1] === 'import') {
          try {
            await importBackup(env, body);
            await addLog(env, 'warn', 'بازیابی پشتیبان انجام شد', 'panel');
            return jsonResponse({ ok: true });
          } catch (e) {
            return jsonResponse({ ok: false, error: String(e && e.message) }, 400);
          }
        }
      }
      return jsonResponse({ ok: false, error: 'مسیر API نامشخص' }, 404);
    }

    /* -------------------------- داشبورد -------------------------- */
    if (path === prefix + '/dash' || path === prefix + '/dash/') {
      if (!(await verifySession(request, settings))) {
        return new Response(null, { status: 303, headers: { location: prefix + '/login' } });
      }
      await ensureDefaultUser(env, settings);
      const state = await apiStateInternal(env, settings, hostInfo);
      return htmlResponse(renderPanel(state));
    }

    /* --------------------- ورودی پروکسی (WebSocket) --------------------- */
    if (upgrade === 'websocket') {
      if (path === prefix) {
        return handleProxyRequest(request, env, ctx, settings, null);
      }
      if (path.startsWith(prefix + '/')) {
        const token = path.slice(prefix.length + 1).split('/')[0];
        const user = token ? await getUserByToken(env, token) : null;
        if (token && !user) return new Response('Not found', { status: 404 });
        return handleProxyRequest(request, env, ctx, settings, user);
      }
      return new Response('Not found', { status: 404 });
    }

    /* --------------------------- استتار --------------------------- */
    if (path === '/' || path === prefix || path.startsWith(prefix + '/')) {
      return serveDisguise(request, settings, ctx);
    }
    return serveDisguise(request, settings, ctx);
  },
};

/* ساختار وضعیت برای رندر پنل */
async function apiStateInternal(env, settings, hostInfo) {
  const users = await listUsers(env);
  return {
    version: VERSION,
    host: hostInfo.host,
    base: hostInfo.proto + '://' + hostInfo.hostHeader,
    settings: publicSettings(settings),
    users: users.map(u => ({
      id: u.id, name: u.name, uuid: u.uuid, trojanPass: u.trojanPass,
      used: u.used, quota: u.quota,
      expireAt: u.expireAt, enabled: u.enabled, deviceLimit: u.deviceLimit, note: u.note,
    })),
  };
}

/* ---------- 11_scanner.js --------------------------------------------- */
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

