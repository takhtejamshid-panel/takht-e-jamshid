#!/usr/bin/env node
/* ==========================================================================
   tools/publish.js — ساخت مخزن در گیت‌هاب و انتشار کد
   --------------------------------------------------------------------------
   استفاده:
       GITHUB_TOKEN='github_pat_...' node tools/publish.js

   توکن از متغیر محیطی خوانده می‌شود و هرگز در فایلی ذخیره نمی‌گردد.
   پیش‌نیازها: نصب بودن git و curl، و انجامِ حداقل یک commit.
   ========================================================================== */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO_NAME = process.env.REPO_NAME || 'takht-e-jamshid';
const PRIVATE = String(process.env.PRIVATE || 'false') === 'true';
const TOKEN = process.env.GITHUB_TOKEN;

const DESCRIPTION = '🏛️ تخت جمشید — پنل مدیریت پروکسی لبه‌ای روی Cloudflare Workers '
  + '(VLESS / Trojan) با داشبورد فارسی، مدیریت کاربران و سهمیه، ربات تلگرام و تولید خودکار کانفیگ.';
const HOMEPAGE = 'https://github.com/';
const TOPICS = [
  'cloudflare-workers', 'vless', 'trojan', 'proxy', 'panel',
  'serverless', 'persian', 'farsi', 'persepolis', 'd1', 'xray',
];

const API = 'https://api.github.com';

function fail(msg) {
  console.error('\n✗ ' + msg + '\n');
  process.exit(1);
}

function api(method, endpoint, body) {
  const args = [
    '-sS', '-X', method,
    API + endpoint,
    '-H', 'Authorization: Bearer ' + TOKEN,
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'X-GitHub-Api-Version: 2022-11-28',
    '-H', 'User-Agent: takht-e-jamshid-publisher',
  ];
  let tmpFile = null;
  if (body !== undefined) {
    tmpFile = path.join(require('os').tmpdir(), 'gh-body-' + Date.now() + '.json');
    fs.writeFileSync(tmpFile, JSON.stringify(body));
    args.push('-H', 'Content-Type: application/json', '--data-binary', '@' + tmpFile);
  }
  let out;
  try {
    out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } finally {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch (e) { /* */ } }
  }
  try { return JSON.parse(out || '{}'); } catch (e) { return { raw: out }; }
}

function git(args, opts) {
  return execFileSync('git', args, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts || {}));
}

/* ------------------------------------------------------------------ */

if (!TOKEN) {
  fail('متغیر محیطی GITHUB_TOKEN تنظیم نشده است.\n'
     + '   مثال:  GITHUB_TOKEN=\'github_pat_...\' node tools/publish.js\n\n'
     + '   توصیه: یک Fine-grained token با دسترسی Contents (Read & write)\n'
     + '          مخصوص همین مخزن بسازید و پس از انتشار آن را باطل کنید.');
}

console.log('\n🏛️  انتشار تخت جمشید روی گیت‌هاب\n' + '─'.repeat(46));

/* ۱) بررسی اعتبار توکن و گرفتن نام کاربر */
console.log('▸ بررسی اعتبار توکن…');
const me = api('GET', '/user');
if (!me.login) {
  fail('توکن پذیرفته نشد: ' + (me.message || JSON.stringify(me).slice(0, 200)));
}
const OWNER = me.login;
console.log('  ✓ کاربر: ' + OWNER + (me.name ? ' (' + me.name + ')' : ''));

/* ۲) بررسی توانایی ساخت مخزن */
const scopes = (() => {
  const r = execFileSync('curl', [
    '-sSI', API + '/user',
    '-H', 'Authorization: Bearer ' + TOKEN,
    '-H', 'User-Agent: takht-e-jamshid-publisher',
  ], { encoding: 'utf8' });
  const m = r.match(/^x-oauth-scopes:\s*(.*)$/im);
  return m ? m[1].trim() : '';
})();
if (scopes && !/\b(repo|public_repo)\b/.test(scopes)) {
  fail('توکن دسترسی لازم برای ساخت مخزن را ندارد.\n'
     + '   دسترسی‌های فعلی: ' + (scopes || '(none)') + '\n'
     + '   دسترسیِ مورد نیاز: repo  (یا برای Fine-grained: Contents: Read & write)');
}

/* ۳) ساخت مخزن (اگر وجود ندارد) */
let repo = api('GET', '/repos/' + OWNER + '/' + REPO_NAME);
let created = false;
if (repo && repo.full_name) {
  console.log('  ✓ مخزن از پیش وجود دارد: ' + repo.full_name);
} else {
  console.log('▸ ساخت مخزن ' + REPO_NAME + ' (' + (PRIVATE ? 'خصوصی' : 'عمومی') + ')…');
  repo = api('POST', '/user/repos', {
    name: REPO_NAME,
    description: DESCRIPTION,
    homepage: HOMEPAGE + OWNER + '/' + REPO_NAME,
    private: PRIVATE,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
    auto_init: false,
    license_template: 'mit',
  });
  if (!repo || !repo.full_name) {
    fail('ساخت مخزن ناموفق بود: ' + ((repo && repo.message) || JSON.stringify(repo).slice(0, 300)));
  }
  created = true;
  console.log('  ✓ ساخته شد: ' + repo.html_url);
}

/* ۴) برچسب‌های موضوع */
console.log('▸ تنظیم موضوع‌ها…');
const topics = api('PUT', '/repos/' + OWNER + '/' + REPO_NAME + '/topics', { names: TOPICS });
if (topics && topics.names) console.log('  ✓ ' + topics.names.join(' · '));
else console.log('  (رد شد — اختیاری)');

/* ۵) بررسی وضعیت گیت محلی */
let branch = 'main';
try {
  branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'main';
} catch (e) {
  fail('این پوشه یک مخزن گیت نیست. ابتدا git init و یک commit انجام دهید.');
}
const dirty = git(['status', '--porcelain']).trim();
if (dirty) {
  console.log('\n  ⚠ هشدار: تغییراتِ ثبت‌نشده وجود دارد. فقط آنچه commit شده منتشر می‌شود.');
}

/* ۶) اتصال remote و ارسال */
console.log('▸ ارسال شاخه‌ی ' + branch + '…');
const remoteUrl = 'https://x-access-token:' + TOKEN + '@github.com/' + OWNER + '/' + REPO_NAME + '.git';
try { git(['remote', 'remove', 'origin']); } catch (e) { /* نبوده */ }
git(['remote', 'add', 'origin', remoteUrl]);
git(['push', '-u', 'origin', branch], { stdio: 'inherit' });
console.log('  ✓ ارسال شد');

/* ۷) برچسب نسخه (منتشرکننده‌ی Release را فعال می‌کند) */
const version = require(path.join(ROOT, 'package.json')).version;
const tag = 'v' + version;
console.log('▸ ارسال برچسب ' + tag + '…');
const hasTag = (() => {
  try { git(['rev-parse', tag], { stdio: 'pipe' }); return true; } catch (e) { return false; }
})();
try {
  if (!hasTag) git(['tag', '-a', tag, '-m', 'تخت جمشید ' + version]);
  git(['push', 'origin', tag, '--force'], { stdio: 'pipe' });
  console.log('  ✓ برچسب ارسال شد — گردش‌کار Release فایل _worker.js را ضمیمه می‌کند');
} catch (e) {
  console.log('  (ارسال برچسب ناموفق بود — بعداً دستی اجرا کنید: git push origin ' + tag + ')');
}

/* ۸) پاک‌سازی: حذف توکن از تنظیمات remote */
console.log('▸ پاک‌سازی…');
git(['remote', 'set-url', 'origin', 'https://github.com/' + OWNER + '/' + REPO_NAME + '.git']);
console.log('  ✓ توکن از تنظیمات remote حذف شد');

/* ------------------------------------------------------------------ */
console.log('\n' + '─'.repeat(46));
console.log('✅ منتشر شد\n');
console.log('   مخزن   : ' + repo.html_url);
console.log('   انتشار : ' + repo.html_url + '/releases/tag/' + tag + '  (چند دقیقه دیگر آماده می‌شود)');
console.log('   اقدامات: ' + repo.html_url + '/actions');
if (created && !PRIVATE) {
  console.log('\n   برای فعال‌سازی Pages (پیش‌نمایش طراحی):');
  console.log('   Settings → Pages → Source: GitHub Actions');
}
console.log('\n⚠️  اکنون توکن را باطل کنید:');
console.log('   https://github.com/settings/personal-access-tokens\n');
