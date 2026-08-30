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
        const okPass = await checkPassword(settings, pass);
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
