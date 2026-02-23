# デプロイ手順

## 前提条件

以下のアカウントとツールが必要です。

| 必要なもの | 用途 |
|-----------|------|
| [Cloudflare アカウント](https://dash.cloudflare.com/sign-up) | Workers / D1 のホスティング |
| [Mailgun アカウント](https://signup.mailgun.com/) | メール受信（Inbound Parse） |
| [Google AI Studio アカウント](https://aistudio.google.com/) | Gemini API キー取得 |
| Slack ワークスペース | Incoming Webhook の作成 |
| Node.js 18 以上 | ローカル開発・デプロイ |

```
npm install -g wrangler   # Wrangler CLI をグローバルインストール
wrangler login            # Cloudflare アカウントにログイン
```

---

## 1. リポジトリのセットアップ

```bash
git clone <repo-url>
cd hermes
npm install
```

---

## 2. Cloudflare D1 データベースの作成

```bash
# D1 データベースを作成
wrangler d1 create hermes-db
```

出力例:

```
✅ Successfully created DB 'hermes-db'

[[d1_databases]]
binding = "DB"
database_name = "hermes-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← これをコピー
```

`wrangler.toml` の `database_id` に上記の ID を貼り付けます。

```toml
[[d1_databases]]
binding = "DB"
database_name = "hermes-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← ここを更新
```

### マイグレーションの適用

```bash
# 本番環境に適用
wrangler d1 migrations apply hermes-db

# ローカル開発用（--local フラグで SQLite に適用）
wrangler d1 migrations apply hermes-db --local
```

---

## 3. シークレットの設定

以下のコマンドで各シークレットを Cloudflare Workers に登録します。
コマンド実行後にプロンプトが表示されるので、値を貼り付けて Enter を押してください。

```bash
wrangler secret put MAILGUN_API_KEY
# Mailgun ダッシュボード → Settings → API Keys → Mailgun API Key または HTTP Webhook Signing Key

wrangler secret put GEMINI_API_KEY
# Google AI Studio → Get API Key

wrangler secret put SLACK_WEBHOOK_URL
# Slack アプリ設定 → Incoming Webhooks → Webhook URL
```

設定確認:

```bash
wrangler secret list
```

各シークレットの取得方法は [secrets.md](./secrets.md) を参照してください。

---

## 4. デプロイ

```bash
npm run deploy
# または
wrangler deploy
```

デプロイが成功すると、以下のような URL が表示されます。

```
Published hermes (1.23 sec)
  https://hermes.<your-subdomain>.workers.dev
```

この URL を控えておきます（次の Mailgun 設定で使用します）。

---

## 5. Mailgun Inbound Parse の設定

Mailgun ダッシュボードで受信メールを Workers に転送するよう設定します。

1. [Mailgun ダッシュボード](https://app.mailgun.com/) にログイン
2. **Receive** → **Routes** を開く（または **Receiving** → **Create Route**）
3. 以下の設定でルートを作成:

| 項目 | 値 |
|------|---|
| Expression Type | `Match Recipient` |
| Recipient | `.*@<your-mailgun-domain>` （例: `.*@mg.example.com`） |
| Action | `Forward` |
| Forward URL | `https://hermes.<your-subdomain>.workers.dev/inbound` |
| Priority | `10` |

4. **Create Route** をクリック

> **Note**: Mailgun のドメイン設定（DNS レコード等）が完了していることを確認してください。
> 詳細は [Mailgun ドキュメント](https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/) を参照。

---

## 6. 動作確認

### ヘルスチェック

```bash
curl https://hermes.<your-subdomain>.workers.dev/health
# 期待レスポンス: {"status":"ok","service":"hermes"}
```

### テストメール送信

Mailgun のドメイン宛にテストメールを送信し、以下を確認します。

1. Slack の指定チャンネルに通知が届く
2. D1 にログが記録される

```bash
# D1 のログを確認
wrangler d1 execute hermes-db --command "SELECT * FROM mail_logs ORDER BY created_at DESC LIMIT 5;"
```

### Mailgun署名のローカルテスト

```bash
# wrangler dev でローカル起動
npm run dev

# 別ターミナルで署名付きリクエストをシミュレート（テスト用）
# 詳細は local-testing.md を参照
```

---

## 7. ログの確認

```bash
# リアルタイムログ（デプロイ済み Worker）
wrangler tail

# D1 のログ一覧
wrangler d1 execute hermes-db --command "SELECT id, from_addr, subject, status, created_at FROM mail_logs ORDER BY created_at DESC LIMIT 20;"

# エラーのみ抽出
wrangler d1 execute hermes-db --command "SELECT * FROM mail_logs WHERE status = 'error' ORDER BY created_at DESC LIMIT 10;"
```

---

## 環境ごとの設定

### ステージング環境

`wrangler.toml` に環境定義を追加することで、本番とは別のステージング環境を作れます。

```toml
[env.staging]
name = "hermes-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "hermes-db-staging"
database_id = "<staging-d1-id>"

[env.staging.vars]
ENVIRONMENT = "staging"
```

```bash
# ステージングにデプロイ
wrangler deploy --env staging

# ステージング用シークレット設定
wrangler secret put MAILGUN_API_KEY --env staging
```
