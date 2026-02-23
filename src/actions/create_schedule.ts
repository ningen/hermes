/**
 * スケジュール登録アクション（Phase 2）
 *
 * Notion API を使用してデータベースにスケジュールエントリを作成する。
 */
import type { CreateScheduleAction, ActionResult } from './types.js';

/**
 * Notion データベースにスケジュールエントリを作成する。
 *
 * Notion Pages API を使用してデータベースにエントリを追加する。
 * データベースには以下のプロパティが必要:
 * - Name (Title): スケジュールのタイトル
 * - Date (Date): 開始/終了時刻
 *
 * @param action     - create_schedule アクション
 * @param apiKey     - Notion API キー (integration token)
 * @param databaseId - ターゲットデータベースの ID
 * @returns アクション実行結果
 */
export async function createSchedule(
  action: CreateScheduleAction,
  apiKey: string,
  databaseId: string
): Promise<ActionResult> {
  try {
    console.log('[create_schedule] Creating Notion database entry:', {
      title: action.params.title,
      startTime: action.params.startTime,
      endTime: action.params.endTime,
    });

    // Notion API ペイロードを構築
    const payload = {
      parent: {
        database_id: databaseId,
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: action.params.title,
              },
            },
          ],
        },
        Date: {
          date: {
            start: action.params.startTime,
            end: action.params.endTime || undefined,
          },
        },
      },
      // 説明がある場合は children として追加（改行ごとに別ブロック）
      children: action.params.description
        ? action.params.description
            .split('\n')
            .map((line) => ({
              object: 'block' as const,
              type: 'paragraph' as const,
              paragraph: {
                rich_text: [
                  {
                    type: 'text' as const,
                    text: {
                      content: line,
                    },
                  },
                ],
              },
            }))
        : undefined,
    };

    // Notion Pages API を呼び出し
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: 'create_schedule',
        success: false,
        error: `Notion API error: ${response.status} ${errorText}`,
      };
    }

    const result = (await response.json()) as { id: string };
    console.log('[create_schedule] Successfully created Notion entry:', result.id);

    return { type: 'create_schedule', success: true };
  } catch (err) {
    return {
      type: 'create_schedule',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
