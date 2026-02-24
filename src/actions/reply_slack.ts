/**
 * Slack 返信アクション
 *
 * Slack Web API の chat.postMessage を使って、
 * インバウンドメッセージが届いたチャンネルに直接返信する。
 */

import type { ReplySlackAction } from './types.js';
import type { ActionResult } from './types.js';

/**
 * Slack にメッセージを返信する
 *
 * @param action - reply_slack アクション（返信内容を含む）
 * @param botToken - Bot User OAuth Token (xoxb-...)
 * @param channelId - 返信先チャンネル ID（元メッセージから取得）
 * @param threadTs - スレッド返信用の ts（省略時はチャンネルに直接投稿）
 */
export async function replySlack(
  action: ReplySlackAction,
  botToken: string,
  channelId: string,
  threadTs?: string
): Promise<ActionResult> {
  const body: Record<string, string> = {
    channel: channelId,
    text: action.params.message,
  };

  if (threadTs) {
    body.thread_ts = threadTs;
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json<{ ok: boolean; error?: string }>();

  if (!data.ok) {
    return {
      type: 'reply_slack',
      success: false,
      error: `Slack API error: ${data.error ?? 'unknown'}`,
    };
  }

  return { type: 'reply_slack', success: true };
}
