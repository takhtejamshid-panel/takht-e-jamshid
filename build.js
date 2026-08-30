#!/usr/bin/env node
/* ==========================================================================
   build.js — تجمیع ماژول‌های src/ در یک فایل _worker.js
   استفاده: node build.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, '_worker.js');

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();

const banner = [
  '/* =============================================================================',
  ' *  تخت جمشید | TAKHT-E JAMSHID — پنل لبه‌ای پارسه',
  ' *  نسخه ' + require('./package.json').version,
  ' *',
  ' *  این فایل به‌صورت خودکار از پوشه‌ی src ساخته شده است؛ خودِ آن را ویرایش نکنید.',
  ' *  جهت توسعه: فایل‌های src/ را تغییر دهید و `node build.js` را اجرا کنید.',
  ' *',
  ' *  پیش‌نیازها:',
  ' *    • یک Worker روی Cloudflare (پلن رایگان کافی است)',
  ' *    • یک دیتابیس D1 با اتصال (Binding) به نام دقیقِ DB',
  ' *',
  ' *  آدرس پنل:  https://<worker>.workers.dev/<route>/dash',
  ' *  ورود پیش‌فرض: admin / admin',
  ' * ============================================================================= */',
  '',
].join('\n');

/* نسخه را از package.json می‌گیریم تا با ثابتِ VERSION در 01_meta.js همگام بماند */
const pkg = require('./package.json');

let body = '';
for (const f of files) {
  let content = fs.readFileSync(path.join(SRC, f), 'utf8');
  if (f === '01_meta.js') {
    const before = content;
    content = content.replace(/const VERSION\s*=\s*'[^']*'/, "const VERSION = '" + pkg.version + "'");
    if (content === before) {
      console.error('✗ ثابتِ VERSION در 01_meta.js پیدا نشد');
      process.exit(1);
    }
  }
  body += '/* ---------- ' + f + ' ' + '-'.repeat(Math.max(0, 58 - f.length)) + ' */\n';
  body += content.replace(/\s+$/, '\n');
  body += '\n';
}

fs.writeFileSync(OUT, banner + body);

const size = fs.statSync(OUT).size;
console.log('✓ ' + path.relative(ROOT, OUT) + ' ساخته شد — ' + files.length + ' ماژول، '
  + (size / 1024).toFixed(1) + ' کیلوبایت');
console.log('  ترتیب: ' + files.join(' → '));
