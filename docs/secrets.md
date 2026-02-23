# シークレットの取得方法

各シークレットの取得手順を説明します。

---

## MAILGUN_API_KEY

Mailgun の署名検証（および Phase 2 のメール返信）に使用します。

1. [Mailgun ダッシュボード](https://app.mailgun.com/) にログイン
2. 右上のユーザーアイコン → **API Security** を開く
3. **HTTP Webhook Signing Key** をコピー

> **注意**: Webhook 署名検証には "Mailgun API Key"（`key-xxx`）ではなく
> **"HTTP Webhook Signing Key"** を使用してください。誤ったキーを使うと署名検証が常に失敗します。

---

## GEMINI_API_KEY

Google Gemini Flash の呼び出しに使用します。

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. **Get API key** → **Create API key** をクリック
3. プロジェクトを選択（または新規作成）してキーを生成
4. 生成されたキー（`AIza...`）をコピー

### 使用量と制限

- Gemini 2.0 Flash Lite: **1,500 リクエスト/日**（無料枠）
- 超過した場合は Gemini API エラーが発生し、メールは `error` ステータスで D1 に記録されます
- 使用量は [Google AI Studio のダッシュボード](https://aistudio.google.com/) で確認できます

---

## SLACK_WEBHOOK_URL

Slack チャンネルへの通知に使用します。

### Slack App の作成（初回のみ）

1. [Slack API](https://api.slack.com/apps) を開き **Create New App** → **From scratch** をクリック
2. App Name（例: `hermes`）とワークスペースを設定
3. **Incoming Webhooks** を開き、**Activate Incoming Webhooks** を ON にする
4. **Add New Webhook to Workspace** をクリック
5. 通知先チャンネル（例: `#general` や `#email-notifications`）を選択して **Allow**
6. 表示された Webhook URL（`https://hooks.slack.com/services/...`）をコピー

### 通知チャンネルの指定

デフォルトのチャンネルは Webhook 作成時に指定したチャンネルになります。
Gemini がアクション決定時に `params.channel` を指定しますが、
Incoming Webhook はデフォルトでは作成時のチャンネル以外に送れない場合があります。

チャンネルを柔軟に切り替えたい場合は、Slack App に **Bot Token** スコープ（`chat:write`）を追加し、
`src/actions/notify_slack.ts` を Chat API（`chat.postMessage`）方式に変更してください。
