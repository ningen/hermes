-- 文字起こしテーブル
CREATE TABLE transcriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL,                -- R2 オブジェクトキー
  status TEXT NOT NULL DEFAULT 'processing',  -- processing | completed | error
  transcript TEXT,                       -- 全文テキスト
  segments TEXT,                         -- JSON: [{speaker, start, end, text}]
  duration_seconds REAL,                 -- 音声の長さ（秒）
  language TEXT,                         -- 検出言語
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX idx_transcriptions_user_created ON transcriptions(user_id, created_at DESC);
