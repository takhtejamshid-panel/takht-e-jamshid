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
