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
