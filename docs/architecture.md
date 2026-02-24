# アーキテクチャ

## システム全体像

```
ユーザー（ブラウザ）
  │  HTTPS
  ▼
Cloudflare Workers  (src/index.ts)
  ├─ 静的ファイル配信    Workers Sites → React SPA
  ├─ REST API           /api/*
  ├─ メール受信         POST /inbound  ← Mailgun Inbound Parse
  └─ Cron              scheduled()    ← 毎時0分

Cloudflare D1 (SQLite)
  └─ 6テーブル: users / user_settings / email_routes
                mail_logs / workflows / workflow_tools / workflow_actions

Cloudflare KV
  ├─ __STATIC_CONTENT  フロントエンド静的ファイル
  └─ SESSIONS          セッション管理（オプション）
```

## ディレクトリ構成

```
hermes/
├── src/
│   ├── index.ts               # Worker エントリーポイント（fetch + scheduled）
│   ├── handlers/
│   │   ├── inbound.ts         # Mailgun Webhook パイプライン
│   │   └── scheduled.ts       # Cron: ワークフロースキャン・実行
│   ├── agent/
│   │   ├── executor.ts        # エージェント（Gemini 呼び出し + アクション実行）
│   │   ├── gemini.ts          # Gemini API クライアント（リトライ付き）
│   │   └── prompt.ts          # プロンプト生成
│   ├── actions/
│   │   ├── types.ts           # Action / ActionResult 型
│   │   ├── notify_slack.ts    # Slack 通知
│   │   ├── reply_email.ts     # メール返信（Mailgun Send API）
│   │   └── create_schedule.ts # Notion Database 登録
│   ├── api/
│   │   ├── router.ts          # /api/* ルーティング
│   │   ├── auth.ts            # /api/auth/*
│   │   ├── settings.ts        # /api/settings
│   │   ├── emailRoute.ts      # /api/routes
│   │   └── workflows.ts       # /api/workflows/*
│   ├── auth/
│   │   ├── jwt.ts             # JWT 署名・検証
│   │   ├── middleware.ts      # Bearer トークン抽出
│   │   ├── password.ts        # PBKDF2-SHA256
│   │   ├── session.ts         # KV セッション
│   │   └── types.ts           # AuthUser 型
│   ├── db/
│   │   ├── d1.ts              # mail_logs CRUD
│   │   ├── users.ts           # users CRUD
│   │   ├── settings.ts        # user_settings CRUD（暗号化含む）
│   │   ├── routes.ts          # email_routes CRUD
│   │   └── workflows.ts       # workflows / tools / actions CRUD
│   ├── filters/
│   │   └── prefilter.ts       # ルールベース事前フィルタ
│   ├── tools/
│   │   ├── registry.ts        # ツールレジストリ
│   │   ├── types.ts           # WorkflowTool インターフェース
│   │   ├── fetch_url.ts       # URL コンテンツ取得
│   │   ├── rss_feed.ts        # RSS フィード
│   │   ├── hacker_news.ts     # Hacker News
│   │   └── http_request.ts    # 汎用 HTTP リクエスト
│   └── utils/
│       └── types.ts           # 共通型（Env / ParsedEmail / WorkflowContext 等）
├── frontend/src/
│   ├── pages/                 # WorkflowsPage / WorkflowFormPage / OnboardingPage
│   ├── components/            # auth / layout / settings
│   ├── services/              # API クライアント
│   └── contexts/              # AuthContext
└── migrations/
    ├── 0001_init.sql                    # mail_logs
    ├── 0002_add_users_and_settings.sql  # users / user_settings / email_routes
    ├── 0003_add_workflows.sql           # workflows / workflow_tools
    └── 0004_add_direct_workflow_mode.sql # workflows.mode / workflow_actions
```

## メール受信パイプライン

```
POST /inbound（Mailgun Inbound Parse）
  │
  ▼
署名検証 (utils/verify.ts)
  ├─ 失敗 → 401（Mailgun に再送させない）
  └─ 成功
       │
       ▼
メールパース → email_routes でユーザー特定
       │
       ▼
事前フィルタ (filters/prefilter.ts)
  ├─ NG → D1(filtered) → 200
  └─ OK
       │
       ▼
ユーザー設定取得 (db/settings.ts)
       │
       ▼
エージェント実行 (agent/executor.ts)
  ├─ Gemini 呼び出し（最大3回リトライ、指数バックオフ: 1s/2s/4s）
  │   ├─ エラー → D1(error) → 200
  │   └─ 成功
  │        │
  │        ▼
  │   アクション実行（1件失敗しても継続）
  │        ├─ notify_slack
  │        ├─ reply_email
  │        ├─ create_schedule
  │        └─ ignore
  └─ D1(processed) → 200
```

## ワークフローパイプライン（Cron）

```
scheduled()（毎時0分）
  │
  ▼
DB から is_active=1 のワークフローを全取得
  │
  ▼
スケジュール判定（hourly / daily:HH / weekly:D:HH）
  │
  ├─ 未到達 → スキップ
  └─ 実行対象
       │
       ▼
workflow_tools を順番に実行（fetch_url / rss_feed 等）
       │
       ▼
エージェント実行 (agent/executor.ts)
  ├─ llm モード  → ツール出力を Gemini に渡してアクション推論
  └─ direct モード → LLM をバイパスし、ユーザー定義アクションを実行
                     （{{tool_id}} テンプレートをツール出力で置換）
       │
       ▼
D1 ログ保存 + last_run_at 更新
```

## API エンドポイント

| メソッド | パス | 認証 | 説明 |
|----------|------|------|------|
| POST | `/api/auth/register` | 不要 | ユーザー登録 |
| POST | `/api/auth/login` | 不要 | ログイン（JWT 返却） |
| GET | `/api/auth/me` | 必要 | 現在のユーザー情報 |
| POST | `/api/auth/logout` | 必要 | ログアウト |
| GET | `/api/settings` | 必要 | ユーザー設定取得 |
| PUT | `/api/settings` | 必要 | ユーザー設定更新 |
| GET | `/api/routes` | 必要 | メールルート一覧 |
| POST | `/api/routes` | 必要 | メールルート作成 |
| DELETE | `/api/routes/:id` | 必要 | メールルート削除 |
| GET | `/api/workflows` | 必要 | ワークフロー一覧 |
| POST | `/api/workflows` | 必要 | ワークフロー作成 |
| GET | `/api/workflows/:id` | 必要 | ワークフロー詳細 |
| PUT | `/api/workflows/:id` | 必要 | ワークフロー更新 |
| DELETE | `/api/workflows/:id` | 必要 | ワークフロー削除 |
| GET | `/api/tools` | 必要 | 利用可能なツール一覧 |
| GET | `/health` | 不要 | ヘルスチェック |
| POST | `/inbound` | 署名検証 | Mailgun Inbound Parse |

## データベーススキーマ

### mail_logs

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| user_id | TEXT | ユーザーID（nullable、ルート未登録メール用） |
| received_at | INTEGER | 受信 Unix timestamp |
| from_addr | TEXT | 送信者 |
| to_addr | TEXT | 受信者 |
| subject | TEXT | 件名 |
| understanding | TEXT | Gemini による内容理解 |
| actions_taken | TEXT | 実行アクション（JSON 配列） |
| status | TEXT | `processed` \| `filtered` \| `error` |
| error_message | TEXT | エラーメッセージ |
| created_at | INTEGER | 作成日時 |

### users

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| email | TEXT | メールアドレス（UNIQUE） |
| password_hash | TEXT | PBKDF2-SHA256 ハッシュ |
| name | TEXT | 表示名 |
| created_at | INTEGER | |
| updated_at | INTEGER | |

### user_settings

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| user_id | TEXT | ユーザーID（UNIQUE） |
| slack_webhook_url | TEXT | Slack Webhook URL（AES-256-GCM 暗号化） |
| notion_api_key | TEXT | Notion API キー（暗号化） |
| notion_database_id | TEXT | Notion DB ID（暗号化） |
| created_at / updated_at | INTEGER | |

### email_routes

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| email_address | TEXT | 受信メールアドレス（UNIQUE） |
| user_id | TEXT | ルーティング先ユーザー |
| is_active | INTEGER | 有効フラグ |
| created_at | INTEGER | |

### workflows

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| user_id | TEXT | オーナーユーザー |
| name | TEXT | ワークフロー名 |
| schedule | TEXT | `hourly` \| `daily:HH` \| `weekly:D:HH` |
| prompt | TEXT | LLM への指示（llm モード用） |
| mode | TEXT | `llm` \| `direct` |
| is_active | INTEGER | 有効フラグ |
| last_run_at | INTEGER | 最終実行日時 |
| created_at | INTEGER | |

### workflow_tools

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| workflow_id | TEXT | 親ワークフロー |
| tool_id | TEXT | ツール識別子（例: `hacker_news`） |
| config | TEXT | ツール設定 JSON |
| order_index | INTEGER | 実行順序 |

### workflow_actions

direct モード専用。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | UUID |
| workflow_id | TEXT | 親ワークフロー |
| action_type | TEXT | `notify_slack` \| `reply_email` \| `create_schedule` \| `ignore` |
| params_template | TEXT | パラメータ JSON（`{{tool_id}}` 変数を含む） |
| order_index | INTEGER | 実行順序 |

## エラーハンドリング方針

| エラー種別 | 対応 |
|-----------|------|
| 署名検証失敗 | `401` を返却（Mailgun に再送させない） |
| フォームデータパース失敗 | `200` を返却（Mailgun 再送防止） |
| 事前フィルタ SKIP | D1 に `filtered` で保存、`200` 返却 |
| Gemini API エラー | 最大3回リトライ（指数バックオフ: 1s/2s/4s）、失敗時は D1 に `error` で保存 |
| アクション実行失敗 | エラーをログに記録し後続アクションを継続、`processed` で保存 |
| D1 書き込みエラー | Worker ログに出力、`200` 返却（Mailgun 再送防止） |

> Mailgun は 25 秒以内に 2xx 以外が返ると再送するため、**署名検証失敗を除き常に 200 OK を返す**。

## Gemini アクション仕様

Gemini が返す JSON 形式:

```json
{
  "understanding": "メール内容の要約（日本語）",
  "actions": [
    {
      "type": "notify_slack",
      "params": {
        "channel": "#general",
        "message": "通知メッセージ"
      }
    }
  ]
}
```

| アクション | 説明 |
|-----------|------|
| `notify_slack` | Slack Incoming Webhook に通知 |
| `ignore` | 何もしない（D1 には `processed` で記録） |
| `reply_email` | Mailgun Send API でメール返信（`MAILGUN_DOMAIN` / `FROM_ADDRESS` が必要） |
| `create_schedule` | Notion Database に予定登録（ユーザー設定の Notion API キーが必要） |

## セキュリティ

| 仕組み | 実装 |
|--------|------|
| パスワード | PBKDF2-SHA256（10,000 iterations） |
| 認証情報暗号化 | AES-256-GCM |
| JWT | HMAC-SHA256、有効期限1時間 |
| セッション | KV に 7 日間保存 |
| Mailgun 署名 | HMAC-SHA256 で検証 |
| パスワード要件 | 最小12文字、数字・大文字・小文字を含む |
