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
  fresh.panelPassHash = await sha256('admin' + fresh.passSalt, true);
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
