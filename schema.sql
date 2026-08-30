-- =============================================================================
--  تخت جمشید — ساختار پایگاه داده (D1 / SQLite)
--
--  نیازی به اجرای دستی این فایل نیست: Worker در اولین اجرا جدول‌ها را
--  خودکار می‌سازد. این فایل برای بررسی، بازیابی دستی و مهاجرت است.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  data        TEXT NOT NULL,          -- تنظیمات به‌صورت JSON
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,     -- شناسه داخلی (۱۲ بایت تصادفیِ هگز)
  name          TEXT NOT NULL,        -- نام نمایشی کاربر
  uuid          TEXT NOT NULL UNIQUE, -- UUID برای VLESS
  trojan_pass   TEXT,                 -- رمز عبور برای Trojan
  token         TEXT NOT NULL UNIQUE, -- توکن لینک اشتراک
  quota_bytes   INTEGER NOT NULL DEFAULT 0,  -- سهمیه بر حسب بایت (۰ = نامحدود)
  used_bytes    INTEGER NOT NULL DEFAULT 0,  -- مصرف تجمعی
  created_at    INTEGER NOT NULL,
  expire_at     INTEGER NOT NULL DEFAULT 0,  -- epoch میلی‌ثانیه (۰ = بدون انقضا)
  device_limit  INTEGER NOT NULL DEFAULT 0,  -- ۰ = نامحدود
  enabled       INTEGER NOT NULL DEFAULT 1,
  note          TEXT DEFAULT '',
  last_seen     INTEGER NOT NULL DEFAULT 0,
  first_use     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_users_uuid  ON users(uuid);

CREATE TABLE IF NOT EXISTS logs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  level    TEXT NOT NULL,             -- info | warn | error
  actor    TEXT DEFAULT '',
  message  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);

-- -----------------------------------------------------------------------------
--  نمونه پرس‌وجوهای کاربردی
-- -----------------------------------------------------------------------------

-- کاربرانی که سهمیه‌شان پر شده:
--   SELECT name, used_bytes, quota_bytes FROM users
--   WHERE quota_bytes > 0 AND used_bytes >= quota_bytes;

-- کاربران منقضی‌شده:
--   SELECT name, expire_at FROM users WHERE expire_at > 0 AND expire_at < strftime('%s','now')*1000;

-- پرمصرف‌ترین کاربران:
--   SELECT name, used_bytes FROM users ORDER BY used_bytes DESC LIMIT 10;

-- پاک‌سازی گزارش‌های قدیمی‌تر از ۳۰ روز:
--   DELETE FROM logs WHERE ts < strftime('%s','now','-30 days')*1000;

-- بازنشانی مصرف همه کاربران (مثلاً در شروع ماه):
--   UPDATE users SET used_bytes = 0;

-- بازیابی مسیر مخفی در صورت فراموشی:
--   SELECT json_extract(data,'$.route') AS route FROM settings WHERE id = 1;
