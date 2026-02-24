-- ワークフローに実行モードを追加する
-- mode = 'llm'    : 従来どおり LLM がアクションを推論する（デフォルト）
-- mode = 'direct' : ユーザーが定義したアクションをそのまま実行する（LLM 不使用）
ALTER TABLE workflows ADD COLUMN mode TEXT NOT NULL DEFAULT 'llm';

-- ユーザー定義アクション設定テーブル
-- direct モードのワークフローで実行するアクションを保持する
-- params_template の文字列値には {{tool_id}} 形式のテンプレート変数を使用できる
-- 例: "message": "最新ニュース:\n{{hacker_news}}"
--   → hacker_news ツールの出力で置換される
CREATE TABLE workflow_actions (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL,
  action_type     TEXT NOT NULL,       -- 'notify_slack' | 'reply_email' | 'create_schedule' | 'ignore'
  params_template TEXT NOT NULL DEFAULT '{}',  -- JSON: アクション固有パラメータ（テンプレート変数あり）
  order_index     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_actions_workflow_id ON workflow_actions(workflow_id);
