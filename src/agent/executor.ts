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
import { replySlack } from '../actions/reply_slack.js';
import { callGemini } from './gemini.js';
import { buildAgentPrompt, buildWorkflowPrompt, buildSlackPrompt } from './prompt.js';

/**
 * エージェントの処理結果
 */
export interface AgentResult {
  understanding: string;
  actionResults: ActionResult[];
}

type UserSettings = {
  replyEmailAddress?: string | null;
  slackWebhookUrl?: string | null;
  notionApiKey?: string | null;
  notionDatabaseId?: string | null;
  slackBotToken?: string | null;
} | null | undefined;

/**
 * reply_slack アクション実行に必要なコンテキスト情報
 */
type SlackReplyContext = {
  channelId: string;
  threadTs?: string;
};

/**
 * 入力コンテキスト（メールまたはワークフロー）を処理し、アクションを実行する。
 *
 * ワークフローが direct モードの場合は Gemini を呼ばず、
 * ユーザー定義アクションをテンプレート展開してそのまま実行する。
 *
 * @param context  - 入力コンテキスト
 * @param env      - 環境変数バインディング
 * @param userSettings - ユーザー固有の設定
 * @param slackReplyCtx - Slack 返信コンテキスト（slack_message 時のみ使用）
 * @returns エージェントの処理結果
 */
export async function runAgent(
  context: InputContext,
  env: Env,
  userSettings?: UserSettings,
  slackReplyCtx?: SlackReplyContext
): Promise<AgentResult> {
  // direct モードのワークフローは LLM をバイパスする
  if (context.type === 'workflow' && context.data.mode === 'direct') {
    return runDirectWorkflow(context.data, env, userSettings);
  }

  // 1. コンテキスト種別に応じたプロンプトを生成
  let prompt: string;
  if (context.type === 'email') {
    prompt = buildAgentPrompt(context.data);
  } else if (context.type === 'workflow') {
    prompt = buildWorkflowPrompt(context.data);
  } else {
    prompt = buildSlackPrompt(context.data);
  }

  // 2. Gemini にプロンプトを送信してアクションを決定
  const geminiResponse: GeminiResponse = await callGemini(prompt, env.GEMINI_API_KEY);

  console.log('[executor] Gemini understanding:', geminiResponse.understanding);
  console.log('[executor] Gemini actions:', JSON.stringify(geminiResponse.actions));

  // 3. 各アクションを実行
  const actionResults = await executeActions(geminiResponse.actions, env, userSettings, slackReplyCtx);

  return {
    understanding: geminiResponse.understanding,
    actionResults,
  };
}

/**
 * direct モードのワークフローを実行する。
 * ユーザーが定義したアクション設定を展開し、LLM なしで直接実行する。
 */
async function runDirectWorkflow(
  wf: import('../utils/types.js').WorkflowContext,
  env: Env,
  userSettings?: UserSettings
): Promise<AgentResult> {
  const directActions = wf.directActions ?? [];
  console.log(`[executor] direct mode: ${directActions.length} action(s) configured`);

  // アクション設定をテンプレート展開して Action 型に変換する
  const actions: Action[] = directActions
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(ac => {
      const expandedParams = expandTemplates(ac.paramsTemplate, wf.toolResults);
      return { type: ac.actionType, params: expandedParams } as Action;
    });

  const actionResults = await executeActions(actions, env, userSettings);

  return {
    understanding: `[direct] ワークフロー "${wf.workflowName}" を実行しました（LLM 不使用）`,
    actionResults,
  };
}

/**
 * paramsTemplate 内の文字列値に含まれる {{tool_id}} プレースホルダーを
 * 対応するツール出力で置換する。
 *
 * 例: "Today's HN:\n{{hacker_news}}" → "Today's HN:\n<hacker_news の出力>"
 */
function expandTemplates(
  paramsTemplate: Record<string, string>,
  toolResults: Array<{ toolId: string; toolName: string; content: string }>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(paramsTemplate)) {
    result[key] = value.replace(/\{\{(\w+)\}\}/g, (_match, toolId: string) => {
      const found = toolResults.find(r => r.toolId === toolId);
      return found ? found.content : `[${toolId}: データなし]`;
    });
  }
  return result;
}

/**
 * アクションリストを実行する。
 * エラーが発生した場合もスキップせず全アクションを試みる。
 */
async function executeActions(
  actions: Action[],
  env: Env,
  userSettings?: UserSettings,
  slackReplyCtx?: SlackReplyContext
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action, env, userSettings, slackReplyCtx);
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
  userSettings?: UserSettings,
  slackReplyCtx?: SlackReplyContext
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

      case 'reply_slack': {
        const botToken = userSettings?.slackBotToken;
        const channelId = slackReplyCtx?.channelId;
        if (!botToken || !channelId) {
          return {
            type: 'reply_slack',
            success: false,
            error: !botToken
              ? 'Slack bot token not configured'
              : 'Slack channel ID not available (reply_slack requires slack_message context)',
          };
        }
        return await replySlack(action, botToken, channelId, slackReplyCtx?.threadTs);
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
