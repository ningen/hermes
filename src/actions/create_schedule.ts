/**
 * スケジュール登録アクション（Phase 2）
 *
 * Google Calendar / Notion 等へのスケジュール登録を行う。
 * 現時点では Phase 2 のスタブ実装。
 */
import type { CreateScheduleAction, ActionResult } from './types.js';

/**
 * スケジュールを登録する。
 *
 * Phase 2 では Google Calendar API または Notion API と連携する。
 * 現在はスタブとしてログのみ出力する。
 *
 * @param action - create_schedule アクション
 * @returns アクション実行結果
 */
export async function createSchedule(
  action: CreateScheduleAction
): Promise<ActionResult> {
  // Phase 2: Google Calendar API / Notion API と連携
  // 現時点ではスタブ実装
  console.log('[create_schedule] Schedule creation requested (Phase 2 stub):', {
    title: action.params.title,
    description: action.params.description,
    startTime: action.params.startTime,
    endTime: action.params.endTime,
  });

  return {
    type: 'create_schedule',
    success: false,
    error: 'create_schedule is not yet implemented (Phase 2)',
  };
}
