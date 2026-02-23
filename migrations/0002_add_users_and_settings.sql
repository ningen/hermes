-- ユーザーテーブル
CREATE TABLE users (
  id              TEXT PRIMARY KEY,           -- UUID
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,              -- Argon2id
  name            TEXT,
  created_at      INTEGER DEFAULT (unixepoch()),
  updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_users_email ON users(email);

-- ユーザー設定テーブル（暗号化された認証情報）
CREATE TABLE user_settings (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL UNIQUE,
  slack_webhook_url     TEXT,                 -- AES-256-GCM暗号化
  notion_api_key        TEXT,                 -- AES-256-GCM暗号化
  notion_database_id    TEXT,                 -- AES-256-GCM暗号化
  created_at            INTEGER DEFAULT (unixepoch()),
  updated_at            INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- メールルーティングテーブル
CREATE TABLE email_routes (
  id              TEXT PRIMARY KEY,
  email_address   TEXT UNIQUE NOT NULL,       -- 例: user1@hermes.domain.com
  user_id         TEXT NOT NULL,
  is_active       INTEGER DEFAULT 1,
  created_at      INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_routes_email ON email_routes(email_address);
CREATE INDEX idx_email_routes_user_id ON email_routes(user_id);

-- 既存のmail_logsにuser_idを追加
ALTER TABLE mail_logs ADD COLUMN user_id TEXT;

CREATE INDEX idx_mail_logs_user_id ON mail_logs(user_id);
