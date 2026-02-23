/**
 * アクション実行オーケストレーター
 *
 * Gemini が決定したアクションを順次実行し、結果を収集する。
 * 1 つのアクションが失敗しても、他のアクションの実行は継続する。
 */
import type { Env, ParsedEmail } from '../utils/types.js';
import type { Action, ActionResult, GeminiResponse } from '../actions/types.js';
import { notifySlack } from '../actions/notify_slack.js';
import { replyEmail } from '../actions/reply_email.js';
import { createSchedule } from '../actions/create_schedule.js';
import { callGemini } from './gemini.js';
import { buildAgentPrompt } from './prompt.js';

/**
 * エージェントの処理結果
 */
export interface AgentResult {
  understanding: string;
  actionResults: ActionResult[];
}

/**
 * メールを Gemini エージェントで処理し、アクションを実行する。
 *
 * @param email - パース済みメール情報
 * @param env   - 環境変数バインディング
 * @returns エージェントの処理結果
 */
export async function runAgent(email: ParsedEmail, env: Env): Promise<AgentResult> {
  // 1. Gemini にプロンプトを送信してアクションを決定
  const prompt = buildAgentPrompt(email);
  const geminiResponse: GeminiResponse = await callGemini(prompt, env.GEMINI_API_KEY);

  console.log('[executor] Gemini understanding:', geminiResponse.understanding);
  console.log('[executor] Gemini actions:', JSON.stringify(geminiResponse.actions));

  // 2. 各アクションを並列実行
  const actionResults = await executeActions(geminiResponse.actions, env);

  return {
    understanding: geminiResponse.understanding,
    actionResults,
  };
}

/**
 * アクションリストを実行する。
 * エラーが発生した場合もスキップせず全アクションを試みる。
 *
 * @param actions - 実行するアクションのリスト
 * @param env     - 環境変数バインディング
 * @returns 各アクションの実行結果
 */
async function executeActions(actions: Action[], env: Env): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action, env);
    results.push(result);

    if (!result.success) {
      console.error(`[executor] Action "${action.type}" failed:`, result.error);
    } else {
      console.log(`[executor] Action "${action.type}" succeeded`);
    }
  }

  return results;
}

/**
 * 単一アクションを実行する。
 */
async function executeAction(action: Action, env: Env): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'notify_slack':
        return await notifySlack(action, env.SLACK_WEBHOOK_URL);

      case 'reply_email':
        // Phase 2: MAILGUN_DOMAIN と FROM_ADDRESS は将来的に環境変数から取得
        return await replyEmail(
          action,
          env.MAILGUN_API_KEY,
          'placeholder.mailgundomain.com', // Phase 2 で環境変数化
          'hermes@placeholder.mailgundomain.com' // Phase 2 で環境変数化
        );

      case 'create_schedule':
        return await createSchedule(action);

      case 'ignore':
        console.log('[executor] Action "ignore": skipping as instructed by Gemini');
        return { type: 'ignore', success: true };

      default: {
        // 未知のアクションタイプ（型安全のための exhaustive check）
        const unknownAction = action as { type: string };
        return {
          type: 'ignore',
          success: false,
          error: `Unknown action type: ${unknownAction.type}`,
        };
      }
    }
  } catch (err) {
    return {
      type: action.type,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
