-- ワークフローテーブル
-- ユーザーが定義するcronベースの自動実行ワークフロー
CREATE TABLE workflows (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  -- スケジュール形式: "hourly" | "daily:09" | "weekly:1:09" (1=月, 7=日, 時刻はUTC)
  schedule    TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_active  ON workflows(is_active, last_run_at);

-- ワークフローに紐付くツール設定
-- order_index 順に実行し、結果をエージェントのコンテキストに注入する
CREATE TABLE workflow_tools (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL,
  tool_id      TEXT NOT NULL,
  config       TEXT NOT NULL DEFAULT '{}',  -- JSON: ツール固有の設定
  order_index  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_tools_workflow_id ON workflow_tools(workflow_id);
