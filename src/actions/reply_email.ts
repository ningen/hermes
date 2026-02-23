/**
 * メール返信アクション（Phase 2）
 *
 * Mailgun Send API を使用して送信者へ自動返信する。
 * 現時点では Phase 2 のスタブ実装。
 */
import type { ReplyEmailAction, ActionResult } from './types.js';

/**
 * Mailgun Send API のベース URL
 */
const MAILGUN_API_BASE = 'https://api.mailgun.net/v3';

/**
 * メール返信を送信する。
 *
 * @param action      - reply_email アクション
 * @param apiKey      - Mailgun API キー
 * @param mailgunDomain - Mailgun の送信ドメイン（環境変数で管理）
 * @param fromAddress - 送信元アドレス
 * @returns アクション実行結果
 */
export async function replyEmail(
  action: ReplyEmailAction,
  apiKey: string,
  mailgunDomain: string,
  fromAddress: string
): Promise<ActionResult> {
  try {
    const formData = new FormData();
    formData.append('from', fromAddress);
    formData.append('to', action.params.to);
    formData.append('subject', action.params.subject);
    formData.append('text', action.params.body);

    const credentials = btoa(`api:${apiKey}`);
    const response = await fetch(
      `${MAILGUN_API_BASE}/${mailgunDomain}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: 'reply_email',
        success: false,
        error: `Mailgun API error: ${response.status} ${errorText}`,
      };
    }

    return { type: 'reply_email', success: true };
  } catch (err) {
    return {
      type: 'reply_email',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
