/**
 * Mailgun 受信ハンドラ
 *
 * Mailgun Inbound Parse から POST される multipart/form-data を処理する。
 */
import type { Env, ParsedEmail, MailgunPayload } from '../utils/types.js';
import { verifyMailgunSignature } from '../utils/verify.js';
import { applyPrefilter } from '../filters/prefilter.js';
import { runAgent } from '../agent/executor.js';
import { saveMailLog } from '../db/d1.js';
import { findEmailRoute } from '../db/routes.js';
import { getUserSettings } from '../db/settings.js';
import { fetchUrlTool } from '../tools/fetch_url.js';

/**
 * UUID v4 を生成する（Web Crypto API を使用）
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Mailgun からの受信メールを処理するメインハンドラ。
 *
 * @param request - HTTP リクエスト
 * @param env     - 環境変数バインディング
 * @returns HTTP レスポンス（常に 200 を返す）
 */
export async function handleInbound(request: Request, env: Env): Promise<Response> {
  const logId = generateUUID();
  const receivedAt = Math.floor(Date.now() / 1000);

  // --- [1] リクエストパース ---
  let payload: MailgunPayload;
  try {
    const formData = await request.formData();
    payload = parseFormData(formData);
  } catch (err) {
    console.error('[inbound] Failed to parse form data:', err);
    // Mailgun 再送防止のため 200 を返す
    return new Response('Bad request', { status: 200 });
  }

  // --- [2] Mailgun 署名検証 ---
  const isValid = await verifyMailgunSignature(
    payload.timestamp,
    payload.token,
    payload.signature,
    env.MAILGUN_API_KEY
  );

  if (!isValid) {
    console.warn('[inbound] Invalid Mailgun signature');
    return new Response('Unauthorized', { status: 401 });
  }

  // --- [3] メール情報をパース ---
  const email: ParsedEmail = {
    from: payload.sender,
    to: payload.recipient,
    subject: payload.subject ?? '',
    body: payload['body-plain'] ?? '',
    messageId: payload['Message-Id'] ?? logId,
    timestamp: receivedAt,
  };

  console.log(`[inbound] Received email from: ${email.from}, subject: ${email.subject}`);

  // --- [3.5] メールルーティング（マルチユーザー対応） ---
  let userId: string | null = null;
  let userSettings: { replyEmailAddress?: string, slackWebhookUrl?: string; notionApiKey?: string; notionDatabaseId?: string } | null = null;

  // 受信メールアドレスからユーザーを検索
  const emailRoute = await findEmailRoute(env.DB, email.to);
  if (emailRoute && emailRoute.isActive) {
    userId = emailRoute.userId;
    console.log(`[inbound] Routed to user: ${userId}`);

    // ユーザー設定を取得
    const settings = await getUserSettings(env.DB, userId, env.ENCRYPTION_KEY);
    if (settings) {
      userSettings = {
        replyEmailAddress: emailRoute.emailAddress,
        slackWebhookUrl: settings.slackWebhookUrl ?? undefined,
        notionApiKey: settings.notionApiKey ?? undefined,
        notionDatabaseId: settings.notionDatabaseId ?? undefined,
      };
    }
  } else {
    console.log('[inbound] No user route found, using fallback environment variables');
  }

  // --- [4] 事前フィルタ ---
  const filterResult = applyPrefilter(email);
  if (!filterResult.pass) {
    console.log(`[inbound] Email filtered: ${filterResult.reason}`);

    try {
      await saveMailLog(env.DB, {
        id: logId,
        receivedAt,
        fromAddr: email.from,
        toAddr: email.to,
        subject: email.subject || null,
        understanding: null,
        actionsTaken: null,
        status: 'filtered',
        errorMessage: filterResult.reason ?? null,
        userId,
      });
    } catch (dbErr) {
      console.error('[inbound] Failed to save filtered log to D1:', dbErr);
    }

    return new Response('OK', { status: 200 });
  }

  // --- [4.5] メール本文のURL取得 ---
  const fetchedUrls = await fetchEmailUrls(email.body, env);
  if (fetchedUrls.length > 0) {
    email.fetchedUrls = fetchedUrls;
    console.log(`[inbound] Fetched ${fetchedUrls.length} URL(s) from email body`);
  }

  // --- [5] Gemini エージェント処理 ---
  try {
    const agentResult = await runAgent({ type: 'email', data: email }, env, userSettings);

    // --- [6] D1 へ処理ログ保存 ---
    try {
      await saveMailLog(env.DB, {
        id: logId,
        receivedAt,
        fromAddr: email.from,
        toAddr: email.to,
        subject: email.subject || null,
        understanding: agentResult.understanding,
        actionsTaken: agentResult.actionResults,
        status: 'processed',
        errorMessage: null,
        userId,
      });
    } catch (dbErr) {
      console.error('[inbound] Failed to save processed log to D1:', dbErr);
    }
  } catch (agentErr) {
    console.error('[inbound] Agent error:', agentErr);

    try {
      await saveMailLog(env.DB, {
        id: logId,
        receivedAt,
        fromAddr: email.from,
        toAddr: email.to,
        subject: email.subject || null,
        understanding: null,
        actionsTaken: null,
        status: 'error',
        errorMessage: agentErr instanceof Error ? agentErr.message : String(agentErr),
        userId,
      });
    } catch (dbErr) {
      console.error('[inbound] Failed to save error log to D1:', dbErr);
    }
  }

  // Mailgun 再送防止のため常に 200 を返す
  return new Response('OK', { status: 200 });
}

/** メール本文から取得するURLの最大件数 */
const MAX_URLS_TO_FETCH = 3;

/**
 * メール本文に含まれるURLを抽出してコンテンツを取得する。
 * 取得失敗したURLはスキップし、メール処理全体は止めない。
 */
async function fetchEmailUrls(
  body: string,
  env: Env
): Promise<Array<{ url: string; content: string }>> {
  const urlPattern = /https?:\/\/[^\s<>"'()[\]{}]+/g;
  const matches = body.match(urlPattern) ?? [];
  // 重複を除去して上限件数に絞る
  const urls = [...new Set(matches)].slice(0, MAX_URLS_TO_FETCH);

  if (urls.length === 0) return [];

  const results: Array<{ url: string; content: string }> = [];
  for (const url of urls) {
    try {
      const result = await fetchUrlTool.execute({ url }, env);
      if (result.success && result.content) {
        results.push({ url, content: result.content });
      } else {
        console.warn(`[inbound] fetchEmailUrls: failed to fetch ${url}: ${result.error}`);
      }
    } catch (err) {
      console.warn(`[inbound] fetchEmailUrls: error fetching ${url}:`, err);
    }
  }
  return results;
}

/**
 * FormData を MailgunPayload 型にパースする。
 */
function parseFormData(formData: FormData): MailgunPayload {
  const get = (key: string): string => {
    const value = formData.get(key);
    if (value === null) return '';
    return typeof value === 'string' ? value : '';
  };

  return {
    timestamp: get('timestamp'),
    token: get('token'),
    signature: get('signature'),
    sender: get('sender'),
    recipient: get('recipient'),
    subject: get('subject'),
    'body-plain': get('body-plain'),
    'body-html': get('body-html') || undefined,
    'Message-Id': get('Message-Id') || undefined,
  };
}
