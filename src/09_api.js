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

async function checkPassword(settings, password) {
  if (!settings.panelPassHash) return String(password) === 'admin';
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
