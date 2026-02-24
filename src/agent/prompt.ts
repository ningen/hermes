/**
 * Gemini へのプロンプト定義
 */
import type { ParsedEmail, WorkflowContext, SlackMessageContext } from '../utils/types.js';

/**
 * メール処理エージェントのシステムプロンプトを生成する。
 *
 * @param email - パース済みメール情報
 * @returns Gemini へ送るプロンプト文字列
 */
export function buildAgentPrompt(email: ParsedEmail): string {
  const urlSection = email.fetchedUrls && email.fetchedUrls.length > 0
    ? `\n# リンク先コンテンツ\n\n${email.fetchedUrls
        .map(({ url, content }) => `## ${url}\n\n${escapePromptValue(content)}`)
        .join('\n\n')}\n`
    : '';

  return `あなたはメール処理エージェントです。
受信メールの内容を理解し、実行すべきアクションを決定してください。

# 利用可能なアクション

- notify_slack: 重要な内容をSlackに通知する
  - params: { "message": "通知メッセージ" }

- reply_email: 送信者に返信する（Phase 2 機能）
  - params: { "to": "送信先アドレス", "subject": "件名", "body": "本文" }

- create_schedule: スケジュール管理アプリへ登録する（Phase 2 機能）
  - params: { "title": "タイトル", "description": "説明（省略可）", "startTime": "ISO8601形式", "endTime": "ISO8601形式（省略可）" }

- ignore: 対応不要（スパム・ニュースレター・定型通知等）
  - params: {}

# 判断基準

- 重要な連絡（問い合わせ・依頼・緊急連絡等）→ notify_slack
- 返信が必要なメール → notify_slack（現時点では返信はPhase 2）
- スパム・広告・ニュースレター・自動通知 → ignore
- 複数のアクションが必要な場合は複数指定可

# 入力メール

件名: ${escapePromptValue(email.subject)}
送信者: ${escapePromptValue(email.from)}
宛先: ${escapePromptValue(email.to)}
本文:
${escapePromptValue(email.body)}
${urlSection}
# 出力形式

必ず以下の JSON 形式のみで返答してください。JSON 以外のテキストは含めないでください。

{
  "understanding": "メール内容の要約（日本語で簡潔に）",
  "actions": [
    {
      "type": "アクション名",
      "params": {}
    }
  ]
}`;
}

/** 利用可能なアクション定義（メール・ワークフロー共通） */
const ACTIONS_DEFINITION = `
- notify_slack: 重要な内容をSlackに通知する
  - params: { "message": "通知メッセージ" }

- reply_email: 送信者に返信する（Phase 2 機能）
  - params: { "to": "送信先アドレス", "subject": "件名", "body": "本文" }

- create_schedule: スケジュール管理アプリへ登録する（Phase 2 機能）
  - params: { "title": "タイトル", "description": "説明（省略可）", "startTime": "ISO8601形式", "endTime": "ISO8601形式（省略可）" }

- ignore: 対応不要
  - params: {}`.trim();

/** Slack インバウンド用の利用可能なアクション定義 */
const SLACK_ACTIONS_DEFINITION = `
- reply_slack: Slack メッセージに直接返信する（最優先）
  - params: { "message": "返信メッセージ（Markdown 可）" }

- notify_slack: 別の Slack チャンネルへ通知する
  - params: { "message": "通知メッセージ" }

- create_schedule: スケジュール管理アプリへ登録する
  - params: { "title": "タイトル", "description": "説明（省略可）", "startTime": "ISO8601形式", "endTime": "ISO8601形式（省略可）" }

- ignore: 対応不要
  - params: {}`.trim();

/** JSON出力形式の指示（共通） */
const OUTPUT_FORMAT = `
# 出力形式

必ず以下の JSON 形式のみで返答してください。JSON 以外のテキストは含めないでください。

{
  "understanding": "内容の要約（日本語で簡潔に）",
  "actions": [
    {
      "type": "アクション名",
      "params": {}
    }
  ]
}`.trim();

/**
 * ワークフロー実行エージェントのプロンプトを生成する。
 *
 * @param wf - ワークフローコンテキスト
 * @returns Gemini へ送るプロンプト文字列
 */
export function buildWorkflowPrompt(wf: WorkflowContext): string {
  const toolSection = wf.toolResults.length > 0
    ? `\n# 取得済みデータ\n\n${wf.toolResults
        .map(r => `## ${r.toolName}\n\n${escapePromptValue(r.content)}`)
        .join('\n\n')}\n`
    : '';

  const triggeredAt = new Date(wf.triggeredAt * 1000).toISOString();

  return `あなたはワークフロー実行エージェントです。
以下のユーザー指示と取得済みデータをもとに、実行すべきアクションを決定してください。

# ユーザー指示

${escapePromptValue(wf.prompt)}
${toolSection}
# 利用可能なアクション

${ACTIONS_DEFINITION}

# 判断基準

- ユーザー指示の内容に従い、適切なアクションを選択してください
- Slack通知やNotionへの登録など、指示に合わせて複数のアクションを組み合わせてください
- 実行すべきことがない場合は ignore を返してください

# 実行日時

${triggeredAt} (UTC) / ワークフロー名: ${escapePromptValue(wf.workflowName)}

${OUTPUT_FORMAT}`;
}

/**
 * Slack メッセージ処理エージェントのプロンプトを生成する。
 *
 * @param ctx - Slack メッセージコンテキスト
 * @returns Gemini へ送るプロンプト文字列
 */
export function buildSlackPrompt(ctx: SlackMessageContext): string {
  const triggeredAt = new Date(ctx.triggeredAt * 1000).toISOString();

  return `あなたは Slack メッセージ処理エージェントです。
ユーザーからの Slack メッセージを理解し、適切なアクションを決定してください。

# 利用可能なアクション

${SLACK_ACTIONS_DEFINITION}

# 判断基準

- 質問・依頼・相談 → reply_slack で直接返答する
- スケジュール登録の依頼 → create_schedule（必要なら reply_slack で確認も）
- 他チャンネルへの共有が必要な場合 → notify_slack
- 意味のない入力や対応不要 → ignore

# 受信メッセージ

送信者 Slack User ID: ${escapePromptValue(ctx.slackUserId)}
受信日時: ${triggeredAt} (UTC)
メッセージ:
${escapePromptValue(ctx.text)}

${OUTPUT_FORMAT}`;
}

/**
 * プロンプトに埋め込む値をサニタイズする。
 * バッククォートや特殊文字がプロンプトインジェクションに使われないよう制限する。
 */
function escapePromptValue(value: string): string {
  // 制御文字を除去し、長さを制限する
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 10000);
}
