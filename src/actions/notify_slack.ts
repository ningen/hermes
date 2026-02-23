/**
 * Slack 通知アクション
 */
import type { NotifySlackAction, ActionResult } from './types.js';

/**
 * Slack Incoming Webhook を使ってメッセージを送信する。
 *
 * @param action     - notify_slack アクション
 * @param webhookUrl - Slack Incoming Webhook URL
 * @returns アクション実行結果
 */
export async function notifySlack(
  action: NotifySlackAction,
  webhookUrl: string
): Promise<ActionResult> {
  try {
    const payload = {
      text: action.params.message,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: 'notify_slack',
        success: false,
        error: `Slack API error: ${response.status} ${errorText}`,
      };
    }

    return { type: 'notify_slack', success: true };
  } catch (err) {
    return {
      type: 'notify_slack',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
