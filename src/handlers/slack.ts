/**
 * Slack Event API ハンドラー
 *
 * Slack からのイベント（DM・メンション）を受け取り、エージェントで処理する。
 * エンドポイント: POST /slack/events/:token
 *
 * 認証・認可フロー:
 * 1. URL トークンでユーザーを特定
 * 2. Slack Signing Secret で署名を検証
 * 3. slack_allowed_user_ids で送信者を確認（許可リスト外はサイレントに無視）
 */

import type { Env, SlackMessageContext } from '../utils/types.js';
import { getUserSettingsBySlackToken } from '../db/settings.js';
import { runAgent } from '../agent/executor.js';

/**
 * Slack Event API のペイロード型
 */
interface SlackUrlVerification {
  type: 'url_verification';
  challenge: string;
}

interface SlackEventCallback {
  type: 'event_callback';
  event: {
    type: string;
    user?: string;
    bot_id?: string;
    text?: string;
    channel: string;
    channel_type?: string;
    ts: string;
    thread_ts?: string;
  };
}

type SlackPayload = SlackUrlVerification | SlackEventCallback;

/**
 * Slack の署名を検証する
 *
 * Slack は X-Slack-Signature ヘッダーに HMAC-SHA256 署名を付与する。
 * フォーマット: v0=<hex_digest>
 * 検証対象: `v0:<timestamp>:<rawBody>`
 */
async function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  // リプレイ攻撃防止: タイムスタンプが5分以上古い場合は拒否
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const expectedSignature = `v0=${signatureHex}`;

  // タイミング攻撃防止のため長さが一致しない場合も false を返す
  if (expectedSignature.length !== signature.length) {
    return false;
  }

  // 定数時間比較
  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Slack Event API ハンドラー
 *
 * @param request - HTTP リクエスト
 * @param env - 環境変数バインディング
 * @param ctx - ExecutionContext
 * @param token - URL パスの :token 部分（ユーザー識別子）
 */
export async function handleSlackEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  token: string
): Promise<Response> {
  // リクエストボディを先に読み取る（署名検証に必要）
  const rawBody = await request.text();

  // トークンでユーザー設定を引く
  const userSettings = await getUserSettingsBySlackToken(env.DB, token, env.ENCRYPTION_KEY);
  if (!userSettings || !userSettings.slackSigningSecret) {
    // トークンが存在しない場合もサイレントに 200 を返す（存在確認を防ぐ）
    return new Response('OK', { status: 200 });
  }

  // Slack 署名検証
  const timestamp = request.headers.get('X-Slack-Request-Timestamp') ?? '';
  const signature = request.headers.get('X-Slack-Signature') ?? '';

  const isValid = await verifySlackSignature(
    userSettings.slackSigningSecret,
    timestamp,
    rawBody,
    signature
  );

  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ペイロードをパース
  let payload: SlackPayload;
  try {
    payload = JSON.parse(rawBody) as SlackPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // URL 検証チャレンジ（Slack App の Event URL 登録時のみ）
  if (payload.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // event_callback 以外は無視
  if (payload.type !== 'event_callback') {
    return new Response('OK', { status: 200 });
  }

  const event = payload.event;

  // Bot 自身のメッセージは無視（無限ループ防止）
  if (event.bot_id) {
    return new Response('OK', { status: 200 });
  }

  // 対象イベント: DM（im）またはメンション（app_mention）
  const isDM = event.type === 'message' && event.channel_type === 'im';
  const isMention = event.type === 'app_mention';
  if (!isDM && !isMention) {
    return new Response('OK', { status: 200 });
  }

  // 送信者が許可リストに含まれているか確認
  const senderId = event.user;
  if (!senderId) {
    return new Response('OK', { status: 200 });
  }

  const allowedIds = (userSettings.slackAllowedUserIds ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  if (allowedIds.length > 0 && !allowedIds.includes(senderId)) {
    // 許可リスト外のユーザー → サイレントに無視
    console.log(`[slack] Ignored message from unauthorized user: ${senderId}`);
    return new Response('OK', { status: 200 });
  }

  // メッセージテキストを取得
  const text = (event.text ?? '').trim();
  if (!text) {
    return new Response('OK', { status: 200 });
  }

  // SlackMessageContext を構築
  const slackContext: SlackMessageContext = {
    text,
    slackUserId: senderId,
    channelId: event.channel,
    threadTs: event.thread_ts,
    triggeredAt: Math.floor(Date.now() / 1000),
  };

  // Slack の 3 秒制限に対応するため、エージェント処理を非同期で実行
  ctx.waitUntil(
    runAgent(
      { type: 'slack_message', data: slackContext },
      env,
      userSettings,
      { channelId: event.channel, threadTs: event.thread_ts }
    ).catch(err => {
      console.error('[slack] Agent error:', err);
    })
  );

  return new Response('OK', { status: 200 });
}
