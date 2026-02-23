# Hermes - Multi-User Email Agent System

Hermesは、Mailgun経由で受信したメールをGemini AIで処理し、Slack通知やNotion予定作成などのアクションを実行するマルチユーザー対応のメールエージェントシステムです。

## 主な機能

- **マルチユーザー認証**: メール/パスワードベースのユーザー登録とログイン
- **ユーザー別設定管理**: 各ユーザーが独自のSlack/Notion認証情報を設定可能
- **メールルーティング**: ユーザー別メールアドレス（例: `user1@hermes.domain.com`）で自動ルーティング
- **暗号化保存**: 認証情報はAES-256-GCMで暗号化して保存
- **Web UI**: React + Tailwind CSSによる管理画面

## 技術スタック

### バックエンド
- Cloudflare Workers（TypeScript）
- Cloudflare D1（SQLite）
- Cloudflare Workers KV（セッション管理）
- Gemini API（メール解析）

### フロントエンド
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router

### セキュリティ
- パスワード: PBKDF2-SHA256（600,000 iterations）
- 認証情報暗号化: AES-256-GCM
- JWT: HMAC-SHA256

## アーキテクチャ

**重要**: このシステムは、バックエンド（API + メール処理）とフロントエンド（React UI）を**同じCloudflare Workerランタイム**にデプロイします。

- Cloudflare Workers Sites機能を使用
- 静的ファイル（フロントエンド）はKVに保存され、Workerから配信
- APIエンドポイント（`/api/*`）とメール受信（`/inbound`）は同じWorkerで処理
- SPAルーティング対応（404時にindex.htmlを返す）

## セットアップ

### 1. 依存関係のインストール

```bash
# ルートディレクトリで実行（バックエンド）
npm install

# フロントエンドの依存関係もインストール
cd frontend
npm install
cd ..
```

### 2. データベースマイグレーション

```bash
# D1データベースにマイグレーションを適用
wrangler d1 migrations apply hermes-db
```

### 3. KVネームスペースの作成（オプション）

```bash
# セッション管理用KVを作成
wrangler kv:namespace create "SESSIONS"

# 出力されたIDを wrangler.toml に追加
# [[kv_namespaces]]
# binding = "SESSIONS"
# id = "YOUR_KV_NAMESPACE_ID"
```

### 4. 暗号化キーの生成

暗号化キーを生成するためのスクリプト:

```typescript
// scripts/generate-keys.ts
import { generateEncryptionKey } from './src/utils/crypto';

console.log('Encryption Key:', await generateEncryptionKey());
console.log('JWT Secret:', crypto.randomUUID() + crypto.randomUUID());
```

実行:

```bash
npx tsx scripts/generate-keys.ts
```

### 5. シークレットの設定

```bash
# JWT署名用シークレット
wrangler secret put JWT_SECRET

# 暗号化キー（ステップ4で生成）
wrangler secret put ENCRYPTION_KEY

# レガシー環境変数（既存システムとの互換性のため）
wrangler secret put MAILGUN_API_KEY
wrangler secret put GEMINI_API_KEY
# 以下はオプション（マイグレーション後は削除可能）
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put NOTION_API_KEY
wrangler secret put NOTION_DATABASE_ID
```

### 6. 統合ビルド・デプロイ

**重要**: フロントエンドとバックエンドは同じWorkerにデプロイされます。

```bash
# フロントエンドをビルドしてからWorkerをデプロイ
npm run deploy
```

このコマンドは以下を実行します：
1. `cd frontend && npm install && npm run build` - フロントエンドをビルド
2. `tsc --noEmit` - TypeScript型チェック
3. `wrangler deploy` - Workerと静的ファイルを一緒にデプロイ

デプロイ後、Worker URLにアクセスすると、フロントエンドUIが表示されます。

### 7. 初期ユーザーの作成

```bash
curl -X POST https://your-worker.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourSecurePassword123","name":"Admin"}'
```

## 開発環境

開発時は、バックエンドとフロントエンドを別々に起動します。

### 1. バックエンド開発サーバー（ターミナル1）

```bash
npm run dev
```

Worker が `http://localhost:8787` で起動します。

### 2. フロントエンド開発サーバー（ターミナル2）

```bash
cd frontend
npm run dev
```

フロントエンドは `http://localhost:3000` で起動し、APIリクエスト（`/api/*`、`/inbound`）は自動的に `http://localhost:8787` にプロキシされます。

**開発時のアクセス**: `http://localhost:3000`
**本番環境**: `https://your-worker.workers.dev` （フロントエンドとバックエンドが統合）

## API エンドポイント

### 認証

- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - 現在のユーザー情報取得
- `POST /api/auth/logout` - ログアウト

### 設定管理

- `GET /api/settings` - ユーザー設定取得
- `PUT /api/settings` - ユーザー設定更新

### メール受信

- `POST /inbound` - Mailgun Inbound Parse エンドポイント

## データベーススキーマ

### users

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | ユーザーID（UUID） |
| email | TEXT | メールアドレス |
| password_hash | TEXT | パスワードハッシュ |
| name | TEXT | 名前 |
| created_at | INTEGER | 作成日時 |
| updated_at | INTEGER | 更新日時 |

### user_settings

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | 設定ID（UUID） |
| user_id | TEXT | ユーザーID |
| slack_webhook_url | TEXT | Slack Webhook URL（暗号化） |
| notion_api_key | TEXT | Notion APIキー（暗号化） |
| notion_database_id | TEXT | Notion データベースID（暗号化） |
| created_at | INTEGER | 作成日時 |
| updated_at | INTEGER | 更新日時 |

### email_routes

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | ルートID（UUID） |
| email_address | TEXT | メールアドレス |
| user_id | TEXT | ユーザーID |
| is_active | INTEGER | アクティブフラグ |
| created_at | INTEGER | 作成日時 |

### mail_logs

| カラム | 型 | 説明 |
|--------|-----|------|
| id | TEXT | ログID（UUID） |
| user_id | TEXT | ユーザーID |
| received_at | INTEGER | 受信日時 |
| from_addr | TEXT | 送信者 |
| to_addr | TEXT | 受信者 |
| subject | TEXT | 件名 |
| understanding | TEXT | AIによる理解 |
| actions_taken | TEXT | 実行アクション（JSON） |
| status | TEXT | ステータス |
| error_message | TEXT | エラーメッセージ |
| created_at | INTEGER | 作成日時 |

## 使い方

### 1. ユーザー登録

Worker URL（例: `https://your-worker.workers.dev/register`）にアクセスしてアカウントを作成します。

または、独自ドメインを設定している場合は `https://your-domain.com/register` にアクセスします。

### 2. 設定

ログイン後、設定画面で以下を入力します：

- **Slack Webhook URL**: Slackへの通知用
- **Notion API Key**: Notion統合のAPIキー
- **Notion Database ID**: 予定を作成するデータベースのID

### 3. メールルートの作成（TODO: UI未実装）

現在、メールルートはAPIまたはD1データベースから直接作成する必要があります：

```bash
curl -X POST https://your-worker.workers.dev/api/routes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emailAddress":"yourname@hermes.domain.com"}'
```

または、D1で直接:

```sql
INSERT INTO email_routes (id, email_address, user_id, is_active, created_at)
VALUES ('uuid-here', 'yourname@hermes.domain.com', 'your-user-id', 1, unixepoch());
```

### 4. Mailgunの設定

Mailgun側で、`yourname@hermes.domain.com` 宛のメールを `/inbound` エンドポイントに転送するよう設定します。

## セキュリティ対策

- パスワードは最小12文字、数字・大文字・小文字を含む必要があります
- 認証情報は全てAES-256-GCMで暗号化されてデータベースに保存されます
- JWTは1時間で期限切れとなります
- セッションはKVに7日間保存されます
- CORSは設定されたフロントエンドドメインのみ許可されます

## デプロイメモ

### Workers Sitesについて

このプロジェクトは**Cloudflare Workers Sites**を使用しています：

- `wrangler.toml` の `[site]` セクションで `frontend/dist` を指定
- デプロイ時、`frontend/dist` 内のすべてのファイルがKVに自動的にアップロード
- `__STATIC_CONTENT` KVネームスペースが自動作成・バインド
- `@cloudflare/kv-asset-handler` を使用して静的ファイルを配信

### カスタムドメインの設定

Cloudflare Dashboardから独自ドメインを追加できます：

1. Workers & Pages → あなたのWorker → Settings → Domains & Routes
2. Custom Domains で独自ドメインを追加
3. DNS設定が自動的に行われます

### デプロイ確認

```bash
# デプロイ後、以下でアクセス可能
# https://hermes.YOUR_SUBDOMAIN.workers.dev

# ヘルスチェック
curl https://hermes.YOUR_SUBDOMAIN.workers.dev/health

# フロントエンド（ブラウザで開く）
# https://hermes.YOUR_SUBDOMAIN.workers.dev/
```

## トラブルシューティング

### フロントエンドが表示されない

1. `frontend/dist` ディレクトリが存在するか確認
2. `npm run build` でフロントエンドをビルド
3. `wrangler deploy` で再デプロイ

### JWT_SECRET が見つからない

```bash
wrangler secret put JWT_SECRET
# ランダムな文字列を入力
```

### ENCRYPTION_KEY が見つからない

暗号化キーを生成して設定してください（セットアップのステップ4, 5を参照）。

### メールが処理されない

1. Mailgunの設定を確認
2. `/inbound` エンドポイントが正しく動作するか確認
3. email_routes テーブルにルートが登録されているか確認
4. D1のmail_logsテーブルでエラーを確認

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！

## サポート

問題がある場合は、GitHubでIssueを作成してください。
