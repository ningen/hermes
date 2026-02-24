# Hermes - Multi-User Email Agent System

Hermes は、Mailgun 経由で受信したメールを Gemini AI で処理し、Slack 通知・Notion 予定作成などのアクションを実行するマルチユーザー対応のメールエージェントシステムです。
加えて、ユーザーが定義した cron ベースのワークフローを定期実行する機能も持ちます。

## 主な機能

- **メールエージェント**: 受信メールを Gemini AI で解析し、Slack 通知・メール返信・Notion 登録を自動実行
- **ワークフロー**: cron スケジュールで定期実行（RSS / Hacker News などのツール取得 → LLM 推論 or 定義済みアクション）
- **マルチユーザー**: メール/パスワード認証、ユーザー別の Slack/Notion 設定
- **Web UI**: React + Tailwind CSS による管理画面（ワークフロー作成・設定管理）
- **暗号化保存**: 認証情報は AES-256-GCM で暗号化して DB に保存

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers (TypeScript) |
| DB | Cloudflare D1 (SQLite) |
| KV | Cloudflare Workers KV（静的ファイル・セッション） |
| AI | Google Gemini API |
| メール | Mailgun Inbound Parse |
| フロントエンド | React 18 + Vite + Tailwind CSS |

## クイックスタート

```bash
# 1. 依存関係のインストール
npm install
cd frontend && npm install && cd ..

# 2. D1 データベース作成とマイグレーション
wrangler d1 create hermes-db
wrangler d1 migrations apply hermes-db

# 3. シークレット設定
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put MAILGUN_API_KEY
wrangler secret put GEMINI_API_KEY

# 4. ビルド＆デプロイ
npm run deploy
```

## ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [CLAUDE.md](./CLAUDE.md) | Claude Code 向け開発ガイド（コマンド・構成・規約） |
| [docs/architecture.md](./docs/architecture.md) | システム構成・処理フロー・DB スキーマ |
| [docs/deployment.md](./docs/deployment.md) | 本番デプロイ手順（Cloudflare + Mailgun 設定） |
| [docs/local-testing.md](./docs/local-testing.md) | ローカル開発・Webhook シミュレーション |
| [docs/secrets.md](./docs/secrets.md) | 各シークレットの取得方法 |

## ライセンス

MIT
