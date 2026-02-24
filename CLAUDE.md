# CLAUDE.md

Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイドです。

## ビルド・開発コマンド

```bash
# 依存関係のインストール
npm install
cd frontend && npm install && cd ..

# 開発サーバー（別ターミナルで起動）
npm run dev                  # バックエンド: http://localhost:8787
cd frontend && npm run dev   # フロントエンド: http://localhost:3000

# 型チェック
npm run typecheck

# ビルド（フロントエンド + 型チェック）
npm run build

# デプロイ（ビルド + wrangler deploy）
npm run deploy

# DBマイグレーション
npm run db:migrate                              # 本番環境
wrangler d1 migrations apply hermes-db --local # ローカル
```

## アーキテクチャ概要

Hermes は Cloudflare Workers 上で動作するマルチユーザー対応のメールエージェントです。
Mailgun 経由でメールを受信し、Gemini AI がアクションを決定、Slack 通知や Notion への記録などを実行します。
加えて、ユーザーが定義した cron ベースのワークフローを定期実行する機能も持ちます。

### 1 Worker で複数の役割を担う

| パス | 処理 |
|------|------|
| `GET /` 等 | Workers Sites 経由で React SPA を配信 |
| `/api/*` | REST API |
| `POST /inbound` | Mailgun Inbound Parse Webhook |
| `scheduled()` | Cron トリガー（毎時）でワークフローを実行 |

## ディレクトリ構成

```
hermes/
├── src/
│   ├── index.ts               # Worker エントリーポイント（fetch + scheduled）
│   ├── handlers/
│   │   ├── inbound.ts         # Mailgun Webhook → 署名検証 → パース → フィルタ → エージェント
│   │   └── scheduled.ts       # Cron: 実行期限を迎えたワークフローをスキャンして実行
│   ├── agent/
│   │   ├── executor.ts        # エージェント本体（Gemini 呼び出し + アクション実行）
│   │   ├── gemini.ts          # Gemini API クライアント（指数バックオフリトライ付き）
│   │   └── prompt.ts          # プロンプト生成（メール用 / ワークフロー用）
│   ├── actions/
│   │   ├── types.ts           # Action / ActionResult 型定義
│   │   ├── notify_slack.ts    # Slack Incoming Webhook 通知
│   │   ├── reply_email.ts     # Mailgun Send API でメール返信
│   │   └── create_schedule.ts # Notion Database へ予定登録
│   ├── api/
│   │   ├── router.ts          # /api/* のルーティング
│   │   ├── auth.ts            # /api/auth/* (register / login / me / logout)
│   │   ├── settings.ts        # /api/settings (GET / PUT)
│   │   ├── emailRoute.ts      # /api/routes (メールアドレス管理)
│   │   └── workflows.ts       # /api/workflows/* (CRUD + ツール・アクション管理)
│   ├── auth/
│   │   ├── jwt.ts             # JWT 署名・検証（HMAC-SHA256）
│   │   ├── middleware.ts      # Bearer トークン抽出ミドルウェア
│   │   ├── password.ts        # PBKDF2-SHA256 パスワードハッシュ
│   │   ├── session.ts         # KV ベースのセッション管理
│   │   └── types.ts           # AuthUser 型
│   ├── db/
│   │   ├── d1.ts              # mail_logs CRUD
│   │   ├── users.ts           # users CRUD
│   │   ├── settings.ts        # user_settings CRUD（暗号化・復号を含む）
│   │   ├── routes.ts          # email_routes CRUD
│   │   └── workflows.ts       # workflows / workflow_tools / workflow_actions CRUD
│   ├── filters/
│   │   └── prefilter.ts       # ルールベース事前フィルタ（noreply・空件名・ニュースレター等）
│   ├── tools/
│   │   ├── registry.ts        # ツールレジストリ（getTool / listTools）
│   │   ├── types.ts           # WorkflowTool インターフェース
│   │   ├── fetch_url.ts       # URL コンテンツ取得
│   │   ├── rss_feed.ts        # RSS フィード取得
│   │   ├── hacker_news.ts     # Hacker News トップ記事取得
│   │   └── http_request.ts    # 汎用 HTTP リクエスト
│   └── utils/
│       └── types.ts           # 共通型（Env, ParsedEmail, WorkflowContext 等）
├── frontend/src/
│   ├── pages/
│   │   ├── WorkflowsPage.tsx  # ワークフロー一覧
│   │   ├── WorkflowFormPage.tsx # ワークフロー作成・編集
│   │   └── OnboardingPage.tsx # 初回セットアップ
│   ├── components/
│   │   ├── auth/              # LoginForm / RegisterForm / ProtectedRoute
│   │   ├── layout/            # Layout
│   │   └── settings/          # SettingsForm（Slack / Notion 設定）
│   ├── services/              # API クライアント関数
│   └── contexts/
│       └── AuthContext.tsx    # 認証状態管理
├── migrations/
│   ├── 0001_init.sql                # mail_logs
│   ├── 0002_add_users_and_settings.sql # users / user_settings / email_routes
│   ├── 0003_add_workflows.sql       # workflows / workflow_tools
│   └── 0004_add_direct_workflow_mode.sql # workflows.mode / workflow_actions
├── docs/                      # 詳細ドキュメント
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## ワークフローシステム

ワークフローは 2 つの実行モードを持ちます：

| モード | 動作 |
|--------|------|
| `llm` | ツールを実行 → 出力を Gemini に渡してアクションを推論 |
| `direct` | ツールを実行 → ユーザー定義アクションを実行（LLM 呼び出しなし） |

`direct` モードのアクションパラメータでは `{{tool_id}}` 形式のテンプレート変数が使えます。
例: `"message": "最新情報:\n{{hacker_news}}"` → `hacker_news` ツールの出力に置換されます。

スケジュール形式: `"hourly"` | `"daily:09"` | `"weekly:1:09"`（曜日 1=月〜7=日、時刻は UTC）

## 新しいツールを追加する

1. `src/tools/<tool_name>.ts` を作成し、`WorkflowTool` インターフェースを実装する
2. `src/tools/registry.ts` の `TOOLS` 配列に追加する（それだけで API・UI に反映される）

## 環境変数（シークレット）

`wrangler secret put <NAME>` で設定：

| 変数名 | 用途 |
|--------|------|
| `JWT_SECRET` | JWT 署名用（32文字以上のランダム文字列） |
| `ENCRYPTION_KEY` | AES-256-GCM 暗号化キー（`crypto.randomUUID() + crypto.randomUUID()` で生成） |
| `MAILGUN_API_KEY` | Mailgun の HTTP Webhook Signing Key |
| `GEMINI_API_KEY` | Google AI Studio の API キー |
| `MAILGUN_DOMAIN` | メール返信に使う送信ドメイン（`reply_email` アクション使用時のみ必須） |
| `FROM_ADDRESS` | メール返信の From アドレス（同上） |

`wrangler.toml` の `[vars]` で設定：

| 変数名 | 値 |
|--------|----|
| `ENVIRONMENT` | `"production"` または `"staging"` |

## ローカル開発

`.dev.vars` を作成してシークレットを設定します（**絶対にコミットしない**）：

```
MAILGUN_API_KEY=your-webhook-signing-key
GEMINI_API_KEY=AIza...
JWT_SECRET=random-string-32-chars-or-more
ENCRYPTION_KEY=random-uuid-plus-random-uuid
```

ローカル DB マイグレーション適用後に開発サーバーを起動してください。
Mailgun Webhook のシミュレーション方法は `docs/local-testing.md` を参照。

## 詳細ドキュメント

| ファイル | 内容 |
|----------|------|
| `docs/architecture.md` | 処理フロー・DB スキーマ・エラーハンドリング方針 |
| `docs/deployment.md` | 本番デプロイ手順（Cloudflare + Mailgun 設定含む） |
| `docs/local-testing.md` | ローカルテスト・Webhook シミュレーション |
| `docs/secrets.md` | 各シークレットの取得方法 |
