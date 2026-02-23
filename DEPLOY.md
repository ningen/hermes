# Hermes デプロイガイド

## クイックスタート

```bash
# 1. 依存関係のインストール
npm install
cd frontend && npm install && cd ..

# 2. データベースマイグレーション
wrangler d1 migrations apply hermes-db

# 3. シークレットの設定
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put MAILGUN_API_KEY
wrangler secret put GEMINI_API_KEY

# 4. ビルド＆デプロイ
npm run deploy
```

## 詳細手順

### 1. 事前準備

必要なもの：
- Node.js 18以上
- Cloudflareアカウント
- Wrangler CLI（`npm install -g wrangler`）
- Wrangler認証（`wrangler login`）

### 2. プロジェクトのクローン

```bash
git clone <repository-url>
cd hermes
```

### 3. 依存関係のインストール

```bash
# バックエンド
npm install

# フロントエンド
cd frontend
npm install
cd ..
```

### 4. D1データベースのセットアップ

#### 既存のデータベースを使用する場合

`wrangler.toml` のデータベースIDがあなたの環境に合っているか確認してください。

#### 新規データベースを作成する場合

```bash
# D1データベースを作成
wrangler d1 create hermes-db

# 出力されたdatabase_idを wrangler.toml に設定
# [[d1_databases]]
# binding = "DB"
# database_name = "hermes-db"
# database_id = "YOUR_DATABASE_ID"
```

#### マイグレーション実行

```bash
wrangler d1 migrations apply hermes-db
```

### 5. KVネームスペースの作成（オプション）

セッション管理にKVを使用する場合：

```bash
# KVネームスペースを作成
wrangler kv:namespace create "SESSIONS"

# 出力されたIDを wrangler.toml のコメントを外して設定
# [[kv_namespaces]]
# binding = "SESSIONS"
# id = "YOUR_KV_NAMESPACE_ID"
```

### 6. シークレットの設定

#### 必須シークレット

```bash
# JWT署名用シークレット（ランダムな文字列）
wrangler secret put JWT_SECRET
# 入力例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# 暗号化キー（後述のスクリプトで生成）
wrangler secret put ENCRYPTION_KEY

# Mailgun APIキー
wrangler secret put MAILGUN_API_KEY

# Gemini APIキー
wrangler secret put GEMINI_API_KEY
```

#### 暗号化キーの生成

Node.jsのREPLで実行：

```javascript
node
> crypto.randomUUID() + crypto.randomUUID()
// 出力をコピーして ENCRYPTION_KEY に使用
```

または、以下のワンライナー：

```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())" | wrangler secret put ENCRYPTION_KEY
```

#### レガシー環境変数（オプション）

後方互換性のため、以下も設定可能：

```bash
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put NOTION_API_KEY
wrangler secret put NOTION_DATABASE_ID
```

### 7. ビルド

```bash
# フロントエンドとバックエンドをビルド
npm run build
```

このコマンドは以下を実行：
1. `cd frontend && npm install && npm run build` - フロントエンドビルド
2. `tsc --noEmit` - TypeScript型チェック

成果物：
- `frontend/dist/` - フロントエンドの静的ファイル

### 8. デプロイ

```bash
wrangler deploy
```

または、ビルドと同時にデプロイ：

```bash
npm run deploy
```

### 9. デプロイ確認

```bash
# Worker URLを確認
wrangler deployments list

# ヘルスチェック
curl https://hermes.YOUR_SUBDOMAIN.workers.dev/health

# レスポンス例: {"status":"ok","service":"hermes"}
```

### 10. 初期ユーザー作成

```bash
curl -X POST https://hermes.YOUR_SUBDOMAIN.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123",
    "name": "Admin"
  }'
```

成功すると、JWTトークンとユーザー情報が返されます。

### 11. Web UIにアクセス

ブラウザで `https://hermes.YOUR_SUBDOMAIN.workers.dev/` を開きます。

ログインページが表示されれば成功です！

## 更新とメンテナンス

### コード変更後の再デプロイ

```bash
# ビルド＆デプロイ
npm run deploy
```

### データベースマイグレーション追加後

```bash
# 新しいマイグレーションを適用
wrangler d1 migrations apply hermes-db

# デプロイ
wrangler deploy
```

### シークレットの更新

```bash
wrangler secret put SECRET_NAME
```

### ログの確認

```bash
# リアルタイムログ
wrangler tail

# デプロイメント履歴
wrangler deployments list
```

## カスタムドメインの設定

1. Cloudflare Dashboard → Workers & Pages
2. あなたのWorkerを選択
3. Settings → Domains & Routes
4. Custom Domains → Add
5. ドメイン名を入力（例: `mail.yourdomain.com`）
6. DNS設定が自動的に行われます

## 環境別設定

### 開発環境

```bash
# ターミナル1: バックエンド
npm run dev

# ターミナル2: フロントエンド
cd frontend && npm run dev
```

アクセス: `http://localhost:3000`

### ステージング環境

```bash
# wrangler.toml をコピー
cp wrangler.toml wrangler.staging.toml

# staging環境用に編集
# name = "hermes-staging"

# ステージングにデプロイ
wrangler deploy --config wrangler.staging.toml
```

### 本番環境

```bash
npm run deploy
```

## トラブルシューティング

### デプロイエラー

```bash
# 詳細なログを表示
wrangler deploy --verbose
```

### フロントエンドが表示されない

1. `frontend/dist` が存在するか確認
   ```bash
   ls -la frontend/dist
   ```

2. フロントエンドを再ビルド
   ```bash
   cd frontend && npm run build && cd ..
   ```

3. 再デプロイ
   ```bash
   wrangler deploy
   ```

### APIが動作しない

1. Worker URLを確認
   ```bash
   wrangler deployments list
   ```

2. ヘルスチェック
   ```bash
   curl https://YOUR_WORKER_URL/health
   ```

3. ログを確認
   ```bash
   wrangler tail
   ```

### データベースエラー

```bash
# マイグレーション状態を確認
wrangler d1 migrations list hermes-db

# マイグレーションを再適用
wrangler d1 migrations apply hermes-db
```

## セキュリティチェックリスト

- [ ] JWT_SECRET は十分にランダムか？（最低32文字推奨）
- [ ] ENCRYPTION_KEY は安全に生成されたか？
- [ ] 本番環境のシークレットは全て設定されているか？
- [ ] データベースのバックアップ戦略はあるか？
- [ ] カスタムドメインにHTTPSが設定されているか？
- [ ] CORS設定は適切か？（本番では特定のオリジンのみ許可推奨）

## パフォーマンス最適化

### Workers Sitesのキャッシュ

Workers Sitesは自動的にKVにキャッシュされますが、以下で最適化可能：

1. `wrangler.toml` で `[site]` セクションに設定追加
2. Cache-Controlヘッダーの調整

### D1クエリ最適化

- インデックスが適切に設定されているか確認
- 頻繁に実行されるクエリを最適化
- 必要に応じてKVにキャッシュ

## バックアップとリストア

### D1データベース

```bash
# エクスポート
wrangler d1 export hermes-db --output backup.sql

# インポート
wrangler d1 execute hermes-db --file backup.sql
```

### 設定のバックアップ

- `wrangler.toml` をバージョン管理
- シークレットは安全な場所に保管（1Password、Vaultなど）
- マイグレーションファイルをバージョン管理

## サポート

問題が発生した場合：

1. [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
2. [Wrangler CLI リファレンス](https://developers.cloudflare.com/workers/wrangler/)
3. プロジェクトのGitHub Issues

---

**デプロイ完了！** 🎉

次のステップ：
1. 初期ユーザーを作成
2. Slack/Notion設定を入力
3. Mailgunの設定でメールを転送
4. メールを送信してテスト
