# ローカルテスト

## ローカル開発サーバーの起動

```bash
npm run dev
# または
wrangler dev
```

デフォルトで `http://localhost:8787` で起動します。

ローカルでは D1 が SQLite でエミュレートされます。先にローカル用マイグレーションを適用してください。

```bash
wrangler d1 migrations apply hermes-db --local
```

---

## ヘルスチェック

```bash
curl http://localhost:8787/health
```

---

## Mailgun リクエストのシミュレーション

ローカルテストでは署名検証をパスする必要があります。以下のスクリプトで署名付きリクエストを生成できます。

### 署名生成スクリプト

```js
// scripts/gen-test-request.mjs
import { createHmac } from 'node:crypto';

const MAILGUN_API_KEY = 'your-webhook-signing-key'; // ← テスト用キーを設定
const timestamp = String(Math.floor(Date.now() / 1000));
const token = crypto.randomUUID().replace(/-/g, '');
const signature = createHmac('sha256', MAILGUN_API_KEY)
  .update(timestamp + token)
  .digest('hex');

console.log('timestamp:', timestamp);
console.log('token:', token);
console.log('signature:', signature);
```

```bash
node scripts/gen-test-request.mjs
```

### curl でリクエスト送信

上記スクリプトの出力値を使って curl でテストします。

```bash
curl -X POST http://localhost:8787/inbound \
  -F "timestamp=<timestamp>" \
  -F "token=<token>" \
  -F "signature=<signature>" \
  -F "sender=test@example.com" \
  -F "recipient=me@mg.yourdomain.com" \
  -F "subject=テスト件名" \
  -F "body-plain=これはテストメールです。重要な依頼があります。至急ご確認ください。"
```

### 期待される動作

- 署名が正しい → `200 OK`、Gemini が呼ばれてアクション実行
- 署名が不正 → `401 Unauthorized`
- フィルタに引っかかる場合（例: noreply アドレス） → `200 OK`、D1 に `filtered` ステータスで記録

---

## D1 ローカルのログ確認

```bash
wrangler d1 execute hermes-db --local \
  --command "SELECT id, from_addr, subject, status, error_message FROM mail_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## 事前フィルタのテスト例

| 条件 | 期待結果 |
|------|---------|
| `sender=noreply@example.com` | `filtered` (No-reply address) |
| `subject=` (空) | `filtered` (Empty subject) |
| `subject=Weekly Newsletter` + 短い本文 | `filtered` (Short body with newsletter keyword) |
| `sender=user@spam-domain.example.com` | `filtered` (Blacklisted domain) |
| 上記以外の通常メール | Gemini 処理 → `processed` |

---

## シークレットのローカル設定

ローカル開発時は `.dev.vars` ファイルにシークレットを設定します。
**このファイルは絶対に Git にコミットしないでください。**

```bash
# .dev.vars （.gitignore に追加済みであることを確認）
MAILGUN_API_KEY=your-webhook-signing-key
GEMINI_API_KEY=AIza...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

`.gitignore` に追加:

```
.dev.vars
```
