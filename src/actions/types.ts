/**
 * アクション型定義
 */

/**
 * Slack 通知アクション
 */
export interface NotifySlackAction {
  type: 'notify_slack';
  params: {
    message: string;
  };
}

/**
 * メール返信アクション（Phase 2）
 */
export interface ReplyEmailAction {
  type: 'reply_email';
  params: {
    to: string;
    subject: string;
    body: string;
  };
}

/**
 * スケジュール登録アクション（Phase 2）
 */
export interface CreateScheduleAction {
  type: 'create_schedule';
  params: {
    title: string;
    description?: string;
    startTime: string;  // ISO 8601
    endTime?: string;   // ISO 8601
  };
}

/**
 * 無視アクション
 */
export interface IgnoreAction {
  type: 'ignore';
  params?: Record<string, never>;
}

/**
 * すべてのアクション型のユニオン
 */
export type Action =
  | NotifySlackAction
  | ReplyEmailAction
  | CreateScheduleAction
  | IgnoreAction;

/**
 * アクションタイプの文字列リテラル
 */
export type ActionType = Action['type'];

/**
 * Gemini が返すレスポンスの型
 */
export interface GeminiResponse {
  understanding: string;
  actions: Action[];
}

/**
 * アクション実行結果
 */
export interface ActionResult {
  type: ActionType;
  success: boolean;
  error?: string;
}
