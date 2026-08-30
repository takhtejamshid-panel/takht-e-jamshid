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

const VERSION = '0.1.0';
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
