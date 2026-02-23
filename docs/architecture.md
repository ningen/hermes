# アーキテクチャ

## システム構成

```
送信者
  │
  ▼
Mailgun (Inbound Parse)
  │ POST multipart/form-data
  ▼
Cloudflare Workers  (src/index.ts)
  ├─ [1] 署名検証         (src/utils/verify.ts)
  ├─ [2] メールパース      (src/handlers/inbound.ts)
  ├─ [3] 事前フィルタ      (src/filters/prefilter.ts)
  ├─ [4] Gemini Agent     (src/agent/)
  │         ├─ プロンプト生成   (agent/prompt.ts)
  │         ├─ Gemini呼び出し  (agent/gemini.ts)
  │         └─ アクション実行   (agent/executor.ts)
  │               ├─ notify_slack    (actions/notify_slack.ts)
  │               ├─ reply_email     (actions/reply_email.ts)    ← Phase 2
  │               └─ create_schedule (actions/create_schedule.ts) ← Phase 2
  └─ [5] D1ログ保存        (src/db/d1.ts)
```

## ディレクトリ構成

```
hermes/
├── src/
│   ├── index.ts                # Workerエントリーポイント
│   ├── handlers/
│   │   └── inbound.ts          # Mailgun受信ハンドラ・パイプライン制御
│   ├── agent/
│   │   ├── gemini.ts           # Gemini APIクライアント（リトライ付き）
│   │   ├── prompt.ts           # プロンプト生成
│   │   └── executor.ts         # アクション実行オーケストレーター
│   ├── actions/
│   │   ├── types.ts            # アクション型定義
│   │   ├── notify_slack.ts     # Slack通知（Phase 1）
│   │   ├── reply_email.ts      # メール返信（Phase 2 スタブ）
│   │   └── create_schedule.ts  # スケジュール登録（Phase 2 スタブ）
│   ├── filters/
│   │   └── prefilter.ts        # 事前フィルタ（ルールベース）
│   ├── db/
│   │   └── d1.ts               # D1操作
│   └── utils/
│       ├── verify.ts           # Mailgun署名検証
│       └── types.ts            # 共通型定義（Env, ParsedEmail等）
├── migrations/
│   └── 0001_init.sql           # mail_logsテーブル定義
├── docs/                       # このドキュメント群
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## 処理フロー

```
受信リクエスト
  │
  ├─ POST /inbound ──→ handleInbound()
  │                         │
  │                    署名検証
  │                     ├─ 失敗 → 401
  │                     └─ 成功
  │                          │
  │                    メールパース
  │                          │
  │                    事前フィルタ
  │                     ├─ NG → D1(filtered) → 200
  │                     └─ OK
  │                          │
  │                    Gemini呼び出し（最大3回リトライ）
  │                     ├─ エラー → D1(error) → 200
  │                     └─ 成功
  │                          │
  │                    アクション実行（1件失敗しても継続）
  │                          │
  │                    D1(processed) → 200
  │
  └─ GET /health ──→ {"status":"ok","service":"hermes"}
```

## エラーハンドリング方針

| エラー種別 | 対応 |
|-----------|------|
| 署名検証失敗 | `401` を返却（Mailgun 再送させない） |
| フォームデータパース失敗 | `200` を返却（Mailgun 再送防止） |
| 事前フィルタ SKIP | D1 に `filtered` で保存、`200` 返却 |
| Gemini API エラー | 最大3回リトライ（指数バックオフ: 1s/2s/4s）、失敗時は D1 に `error` で保存 |
| アクション実行失敗 | エラーをログ保存・後続アクション継続、`processed` で保存 |
| D1 書き込みエラー | Worker Log に出力、`200` 返却（Mailgun 再送防止） |

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

| アクション | 状態 | 説明 |
|-----------|------|------|
| `notify_slack` | Phase 1 実装済み | Slack Incoming Webhook に通知 |
| `ignore` | Phase 1 実装済み | 何もしない（D1 には `processed` で記録） |
| `reply_email` | Phase 2 スタブ | Mailgun Send API でメール返信 |
| `create_schedule` | Phase 2 スタブ | Google Calendar / Notion 等に登録 |

## ロードマップ

### Phase 1（実装済み）
- Mailgun 受信 → Gemini 処理 → Slack 通知
- 事前フィルタ
- D1 処理ログ

### Phase 2
- `reply_email`: Mailgun Send API によるメール自動返信
  - 環境変数 `MAILGUN_DOMAIN`, `FROM_ADDRESS` の追加が必要
- `create_schedule`: Google Calendar / Notion との連携

### Phase 3（検討中）
- アクション定義の D1 管理・動的追加
- 処理ログ閲覧 UI（Cloudflare Pages）
- Cloudflare Queues による非同期化（高負荷対応）
