CREATE TABLE mail_logs (
  id              TEXT PRIMARY KEY,       -- UUID
  received_at     INTEGER NOT NULL,       -- Unix timestamp
  from_addr       TEXT NOT NULL,
  to_addr         TEXT NOT NULL,
  subject         TEXT,
  understanding   TEXT,                   -- Geminiによる内容理解
  actions_taken   TEXT,                   -- 実行したアクションのJSON配列
  status          TEXT NOT NULL,          -- processed | filtered | error
  error_message   TEXT,
  created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_status ON mail_logs(status);
CREATE INDEX idx_received_at ON mail_logs(received_at);
CREATE INDEX idx_from_addr ON mail_logs(from_addr);
