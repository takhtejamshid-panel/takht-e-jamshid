#!/usr/bin/env node
/* ==========================================================================
   tools/preview.js — ساخت پیش‌نمایش ایستا از پنل برای مشاهده‌ی طراحی
   خروجی: preview/panel-preview.html , login-preview.html , status-preview.html
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { Miniflare } = require('miniflare');

const ROOT = path.join(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT, 'preview');
const FAKE_HOST = 'https://takht-e-jamshid.example.workers.dev';

const SAMPLE_USERS = [
  { name: 'کوروش', quota: '100GB', used: 41 * 1024 ** 3, expireDays: 210, deviceLimit: 5 },
  { name: 'داریوش', quota: '50GB', used: 12.4 * 1024 ** 3, expireDays: 90, deviceLimit: 3 },
  { name: 'خشایارشا', quota: '30GB', used: 28.9 * 1024 ** 3, expireDays: 14, deviceLimit: 2 },
  { name: 'اردشیر', quota: '0', used: 77.2 * 1024 ** 3, expireDays: 0, deviceLimit: 0 },
  { name: 'کمبوجیه', quota: '10GB', used: 10 * 1024 ** 3, expireDays: 3, deviceLimit: 1 },
  { name: 'بردیا', quota: '20GB', used: 3.1 * 1024 ** 3, expireDays: -2, deviceLimit: 2 },
];

(async () => {
  if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

  const mf = new Miniflare({
    scriptPath: path.join(ROOT, '_worker.js'),
    modules: true,
    compatibilityDate: '2024-09-23',
    d1Databases: { DB: 'preview' },
  });
  const B = 'http://panel.test';
  const req = (p, init) => mf.dispatchFetch(B + p, Object.assign({ redirect: 'manual' }, init || {}));

  // ورود
  let r = await req('/takht/login', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'user=dariush&pass=admin',
  });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const auth = (p, init) => {
    const i = init || {};
    return req(p, Object.assign({}, i, { headers: Object.assign({ cookie }, i.headers || {}) }));
  };
  const post = async (p, body) => {
    const res = await auth(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  // پیکربندی نمونه
  await post('/takht/api/settings', {
    host: 'takht-e-jamshid.example.workers.dev',
    cleanIPs: ['162.159.192.1#Frankfurt-DE', '172.66.40.1#Amsterdam-NL', '188.114.96.1#Paris-FR', '104.16.0.1#San Jose-US'],
    naming: '{FLAG} {CITY} · {NUM}',
    protocol: 'both',
    ports: [443, 80, 2053, 2083, 2087, 2096, 8443],
  });

  await auth('/takht/dash');   // ایجاد کاربر پیش‌فرض
  await post('/takht/api/users/delete', { id: (await (await auth('/takht/api/state')).json()).users[0].id });

  for (const u of SAMPLE_USERS) {
    const j = await post('/takht/api/users/create', {
      name: u.name, quota: u.quota, expireDays: Math.max(0, u.expireDays), deviceLimit: u.deviceLimit,
    });
    const id = j.user && j.user.id;
    if (!id) continue;
    await post('/takht/api/users/update', { id, used: Math.round(u.used) });
    if (u.expireDays < 0) {
      await post('/takht/api/users/update', { id, expireAt: Date.now() + u.expireDays * 86400000 });
    }
  }

  const state = await (await auth('/takht/api/state')).json();
  const logs = await (await auth('/takht/api/logs')).json();
  let html = await (await auth('/takht/dash')).text();

  /* تزریق داده به‌جای فراخوانی شبکه‌ای (پیش‌نمایش آفلاین) */
  const boot = JSON.stringify({
    ok: true,
    version: state.version,
    host: 'takht-e-jamshid.example.workers.dev',
    base: FAKE_HOST,
    settings: state.settings,
    users: state.users,
  });
  const bootLogs = JSON.stringify({ ok: true, logs: logs.logs || [] });

  html = html.replace(
    'load();});',
    'S=' + boot + ';LANG="fa";renderOverview();renderSettings();renderNetwork();renderTelegram();'
    + 'var __L=' + bootLogs + ';'
    + 'renderLogs0(__L.logs);'
    + 'go("overview");'
    + '});'
  );
  // نمایش گزارش‌ها بدون نیاز به شبکه
  html = html.replace(
    'async function renderLogs(){var r=await jget("/logs");var c=$("log-body");c.innerHTML="";',
    'async function renderLogs(){var r=await jget("/logs");var c=$("log-body");if(c.dataset.done)return;c.dataset.done="1";'
  );
  html = html.replace(
    'function renderLogs(){',
    'function renderLogs0(items){var c=$("log-body");c.innerHTML="";'
      + 'if(!items.length){c.innerHTML=\'<div class="empty">گزارشی ثبت نشده</div>\';return}'
      + 'for(var i=0;i<items.length;i++){var L=items[i];var d=el("div","logline");'
      + 'd.appendChild(el("span","muted",new Date(L.ts).toLocaleString("fa-IR")+" · "));'
      + 'var s=el("span");s.style.color=L.level==="error"?"#f87171":(L.level==="warn"?"#fbbf24":"#a99e86");'
      + 's.textContent="["+L.level+"] ";d.appendChild(s);'
      + 'd.appendChild(document.createTextNode(L.message));c.appendChild(d);}}'
      + 'function renderLogs(){'
  );
  html = html.replace(/http:\/\/panel\.test/g, FAKE_HOST);
  html = html.replace(/panel\.test/g, 'takht-e-jamshid.example.workers.dev');

  fs.writeFileSync(path.join(PREVIEW_DIR, 'panel-preview.html'), html);

  // صفحه ورود
  let login = await (await req('/takht/login')).text();
  fs.writeFileSync(path.join(PREVIEW_DIR, 'login-preview.html'), login.replace(/http:\/\/panel\.test/g, FAKE_HOST).replace(/panel\.test/g,'takht-e-jamshid.example.workers.dev'));

  // صفحه وضعیت کاربر
  const first = state.users[0];
  if (first) {
    const sub = await (await auth('/takht/api/link/' + first.id)).json();
    const st = await req(sub.url.replace(B, '') + '?page=1');
    let sh = await st.text();
    fs.writeFileSync(path.join(PREVIEW_DIR, 'status-preview.html'), sh.replace(/http:\/\/panel\.test/g, FAKE_HOST).replace(/panel\.test/g,'takht-e-jamshid.example.workers.dev'));
  }

  await mf.dispose();
  console.log('✓ پیش‌نمایش‌ها در پوشه‌ی preview ساخته شدند:');
  for (const f of fs.readdirSync(PREVIEW_DIR)) {
    console.log('   • preview/' + f + '  (' + (fs.statSync(path.join(PREVIEW_DIR, f)).size / 1024).toFixed(1) + ' KB)');
  }
})().catch(e => { console.error(e); process.exit(1); });
