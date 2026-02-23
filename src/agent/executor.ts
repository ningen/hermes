/**
 * アクション実行オーケストレーター
 *
 * Gemini が決定したアクションを順次実行し、結果を収集する。
 * 1 つのアクションが失敗しても、他のアクションの実行は継続する。
 */
import type { Env, InputContext } from '../utils/types.js';
import type { Action, ActionResult, GeminiResponse } from '../actions/types.js';
import { notifySlack } from '../actions/notify_slack.js';
import { replyEmail } from '../actions/reply_email.js';
import { createSchedule } from '../actions/create_schedule.js';
import { callGemini } from './gemini.js';
import { buildAgentPrompt, buildWorkflowPrompt } from './prompt.js';

/**
 * エージェントの処理結果
 */
export interface AgentResult {
  understanding: string;
  actionResults: ActionResult[];
}

type UserSettings = {
  replyEmailAddress?: string;
  slackWebhookUrl?: string;
  notionApiKey?: string;
  notionDatabaseId?: string;
} | null | undefined;

/**
 * 入力コンテキスト（メールまたはワークフロー）を Gemini エージェントで処理し、アクションを実行する。
 *
 * @param context  - 入力コンテキスト
 * @param env      - 環境変数バインディング
 * @param userSettings - ユーザー固有の設定
 * @returns エージェントの処理結果
 */
export async function runAgent(
  context: InputContext,
  env: Env,
  userSettings?: UserSettings
): Promise<AgentResult> {
  // 1. コンテキスト種別に応じたプロンプトを生成
  const prompt = context.type === 'email'
    ? buildAgentPrompt(context.data)
    : buildWorkflowPrompt(context.data);

  // 2. Gemini にプロンプトを送信してアクションを決定
  const geminiResponse: GeminiResponse = await callGemini(prompt, env.GEMINI_API_KEY);

  console.log('[executor] Gemini understanding:', geminiResponse.understanding);
  console.log('[executor] Gemini actions:', JSON.stringify(geminiResponse.actions));

  // 3. 各アクションを実行
  const actionResults = await executeActions(geminiResponse.actions, env, userSettings);

  return {
    understanding: geminiResponse.understanding,
    actionResults,
  };
}

/**
 * アクションリストを実行する。
 * エラーが発生した場合もスキップせず全アクションを試みる。
 */
async function executeActions(
  actions: Action[],
  env: Env,
  userSettings?: UserSettings
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action, env, userSettings);
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
async function executeAction(
  action: Action,
  env: Env,
  userSettings?: UserSettings
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'notify_slack': {
        const slackWebhookUrl = userSettings?.slackWebhookUrl;
        if (!slackWebhookUrl) {
          return {
            type: 'notify_slack',
            success: false,
            error: 'Slack webhook URL not configured',
          };
        }
        return await notifySlack(action, slackWebhookUrl);
      }

      case 'reply_email':
        if (!userSettings?.replyEmailAddress) {
          return {
            type: 'reply_email',
            success: false,
            error: 'replyEmailAddress is not configured',
          };
        }
        return await replyEmail(
          action,
          env.MAILGUN_API_KEY,
          env.MAILGUN_DOMAIN,
          userSettings.replyEmailAddress
        );

      case 'create_schedule': {
        const notionApiKey = userSettings?.notionApiKey;
        const notionDatabaseId = userSettings?.notionDatabaseId;
        if (!notionApiKey || !notionDatabaseId) {
          return {
            type: 'create_schedule',
            success: false,
            error: 'Notion API key or database ID not configured',
          };
        }
        return await createSchedule(action, notionApiKey, notionDatabaseId);
      }

      case 'ignore':
        console.log('[executor] Action "ignore": skipping as instructed by Gemini');
        return { type: 'ignore', success: true };

      default: {
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
