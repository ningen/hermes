/**
 * Cloudflare Workers Cron ハンドラ
 *
 * wrangler.toml で "0 * * * *"（毎時0分）に設定される。
 * アクティブなワークフローを全件スキャンし、実行タイミングに達したものを処理する。
 */
import type { Env, WorkflowContext } from '../utils/types.js';
import {
  getAllActiveWorkflows,
  getWorkflowTools,
  updateWorkflowLastRun,
  type Workflow,
} from '../db/workflows.js';
import { getUserSettings } from '../db/settings.js';
import { getTool } from '../tools/registry.js';
import { runAgent } from '../agent/executor.js';

/**
 * Cron イベントのエントリーポイント
 */
export async function handleScheduled(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const nowDate = new Date(now * 1000);

  console.log(`[scheduled] Starting cron run at ${nowDate.toISOString()}`);

  const workflows = await getAllActiveWorkflows(env.DB);
  console.log(`[scheduled] Found ${workflows.length} active workflow(s)`);

  for (const workflow of workflows) {
    if (!shouldRunNow(workflow.schedule, workflow.lastRunAt, nowDate)) {
      continue;
    }

    console.log(`[scheduled] Running workflow: ${workflow.id} (${workflow.name})`);

    try {
      await executeWorkflow(workflow, env, now);
      await updateWorkflowLastRun(env.DB, workflow.id, now);
      console.log(`[scheduled] Workflow ${workflow.id} completed`);
    } catch (err) {
      console.error(`[scheduled] Workflow ${workflow.id} failed:`, err);
      // 失敗してもlast_run_atを更新して無限リトライを防ぐ
      await updateWorkflowLastRun(env.DB, workflow.id, now).catch(() => {});
    }
  }

  console.log('[scheduled] Cron run finished');
}

/**
 * ワークフローを実行する。
 * 1. ツールを順番に実行してコンテキストを収集
 * 2. エージェントにコンテキストと指示を渡して実行
 */
async function executeWorkflow(
  workflow: Workflow,
  env: Env,
  now: number
): Promise<void> {
  // ユーザー設定を取得（Slack/Notion credentials）
  const settings = await getUserSettings(env.DB, workflow.userId, env.ENCRYPTION_KEY);
  const userSettings = settings
    ? {
        slackWebhookUrl: settings.slackWebhookUrl ?? undefined,
        notionApiKey: settings.notionApiKey ?? undefined,
        notionDatabaseId: settings.notionDatabaseId ?? undefined,
      }
    : null;

  // ツールを実行してコンテキストを収集
  const toolConfigs = await getWorkflowTools(env.DB, workflow.id);
  const toolResults: WorkflowContext['toolResults'] = [];

  for (const tc of toolConfigs) {
    const tool = getTool(tc.toolId);
    if (!tool) {
      console.warn(`[scheduled] Unknown tool: ${tc.toolId}`);
      continue;
    }

    console.log(`[scheduled] Executing tool ${tc.toolId} for workflow ${workflow.id}`);
    // toolResults には現時点までに完了したツールの結果のみが含まれる（このツールより前のもの）
    const result = await tool.execute(tc.config, env, toolResults);

    if (result.success) {
      toolResults.push({
        toolId: tc.toolId,
        toolName: tool.name,
        content: result.content,
      });
    } else {
      console.warn(`[scheduled] Tool ${tc.toolId} failed: ${result.error}`);
      // ツールが失敗してもエラー情報をコンテキストとして渡す
      toolResults.push({
        toolId: tc.toolId,
        toolName: tool.name,
        content: `[取得失敗: ${result.error}]`,
      });
    }
  }

  const context: WorkflowContext = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    prompt: workflow.prompt,
    triggeredAt: now,
    toolResults,
  };

  await runAgent({ type: 'workflow', data: context }, env, userSettings);
}

/**
 * ワークフローを今回の Cron 起動時に実行すべきかを判定する。
 *
 * スケジュール形式:
 *   "hourly"         - 毎時（55分以上経過していれば実行）
 *   "daily:09"       - 毎日 09:00 UTC
 *   "weekly:1:09"    - 毎週月曜 09:00 UTC（1=月, 7=日）
 */
export function shouldRunNow(
  schedule: string,
  lastRunAt: number | null,
  nowDate: Date
): boolean {
  const now = Math.floor(nowDate.getTime() / 1000);
  const last = lastRunAt ?? 0;

  if (schedule === 'hourly') {
    return now - last >= 55 * 60;
  }

  if (schedule.startsWith('daily:')) {
    const targetHour = parseInt(schedule.split(':')[1], 10);
    if (isNaN(targetHour) || nowDate.getUTCHours() !== targetHour) return false;
    // 本日すでに実行済みかチェック
    const lastDate = new Date(last * 1000);
    return !(
      lastDate.getUTCFullYear() === nowDate.getUTCFullYear() &&
      lastDate.getUTCMonth() === nowDate.getUTCMonth() &&
      lastDate.getUTCDate() === nowDate.getUTCDate()
    );
  }

  if (schedule.startsWith('weekly:')) {
    const parts = schedule.split(':');
    const targetDow = parseInt(parts[1], 10); // 1=月, 7=日
    const targetHour = parseInt(parts[2], 10);
    if (isNaN(targetDow) || isNaN(targetHour)) return false;
    // JS の getUTCDay(): 0=日, 1=月, ..., 6=土
    const jsDow = targetDow === 7 ? 0 : targetDow;
    if (nowDate.getUTCDay() !== jsDow) return false;
    if (nowDate.getUTCHours() !== targetHour) return false;
    // 6日以上経過していれば実行（同週の重複実行防止）
    return now - last >= 6 * 24 * 60 * 60;
  }

  return false;
}
