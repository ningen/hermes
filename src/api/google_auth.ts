/**
 * Google OAuth2 認証フロー
 *
 * 1. GET /api/auth/google/url  → 認証 URL を生成して返す（Bearer 認証必須）
 * 2. GET /api/auth/google/callback → Google からのコールバックを処理してリフレッシュトークンを保存
 * 3. DELETE /api/auth/google → Google カレンダー連携を解除
 */

import type { Env } from '../utils/types.js';
import { requireAuth } from '../auth/middleware.js';
import { encrypt } from '../utils/crypto.js';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * HMAC-SHA256 で署名する（state パラメータの改ざん検知用）
 */
async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * OAuth state を生成する（userId + タイムスタンプ + HMAC 署名）
 */
async function createOAuthState(userId: string, jwtSecret: string): Promise<string> {
  const payload = JSON.stringify({ userId, ts: Math.floor(Date.now() / 1000) });
  const encoded = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await hmacSign(encoded, jwtSecret);
  return `${encoded}.${sig}`;
}

/**
 * OAuth state を検証する
 * @returns 検証成功時は userId、失敗時は null
 */
async function verifyOAuthState(
  state: string,
  jwtSecret: string
): Promise<string | null> {
  try {
    const parts = state.split('.');
    if (parts.length !== 2) return null;

    const [encoded, sig] = parts;
    const expectedSig = await hmacSign(encoded, jwtSecret);

    // 定数時間比較でタイミング攻撃を防ぐ
    if (sig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (diff !== 0) return null;

    // タイムスタンプの有効期限をチェック（10分以内）
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    base64 += '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(base64)) as { userId: string; ts: number };

    const now = Math.floor(Date.now() / 1000);
    if (now - payload.ts > 600) return null;

    return payload.userId;
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/google/url
 * Google OAuth 認証 URL を生成して返す（Bearer 認証必須）
 */
export async function handleGoogleAuthUrl(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId: string) => {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Google OAuth not configured' }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const state = await createOAuthState(userId, env.JWT_SECRET);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',  // 毎回 refresh_token を確実に返させる
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(
      JSON.stringify({ url: authUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
}

/**
 * GET /api/auth/google/callback
 * Google からのリダイレクトを受け取り、リフレッシュトークンを保存する
 */
export async function handleGoogleAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // エラー時はフロントエンドへリダイレクト
  if (error || !code || !state) {
    return Response.redirect(`${url.origin}/settings?google=error&reason=${encodeURIComponent(error ?? 'missing_params')}`, 302);
  }

  // state を検証してユーザーIDを取得
  const userId = await verifyOAuthState(state, env.JWT_SECRET);
  if (!userId) {
    return Response.redirect(`${url.origin}/settings?google=error&reason=invalid_state`, 302);
  }

  // 認可コードをトークンに交換
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenResponse.json() as GoogleTokenResponse;

  if (!tokenResponse.ok || tokenData.error || !tokenData.refresh_token) {
    console.error('[google_auth] Token exchange failed:', tokenData);
    const reason = tokenData.error ?? 'token_exchange_failed';
    return Response.redirect(`${url.origin}/settings?google=error&reason=${encodeURIComponent(reason)}`, 302);
  }

  const now = Math.floor(Date.now() / 1000);

  // user_settings が存在するか確認
  const existing = await env.DB.prepare(
    `SELECT id FROM user_settings WHERE user_id = ?`
  ).bind(userId).first<{ id: string }>();

  const encryptedToken = await encrypt(tokenData.refresh_token, env.ENCRYPTION_KEY);

  if (existing) {
    // 既存行の google_refresh_token のみ更新（他のフィールドは保持）
    await env.DB.prepare(
      `UPDATE user_settings
       SET google_refresh_token = ?, updated_at = ?
       WHERE user_id = ?`
    )
      .bind(encryptedToken, now, userId)
      .run();
  } else {
    // 新規行を作成（google_refresh_token のみ設定）
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO user_settings (id, user_id, google_refresh_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, userId, encryptedToken, now, now)
      .run();
  }

  console.log('[google_auth] Refresh token saved for user:', userId);

  return Response.redirect(`${url.origin}/settings?google=connected`, 302);
}

/**
 * DELETE /api/auth/google
 * Google カレンダー連携を解除する（Bearer 認証必須）
 */
export async function handleGoogleAuthDisconnect(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId: string) => {
    await env.DB.prepare(
      `UPDATE user_settings
       SET google_refresh_token = NULL, google_calendar_id = NULL, updated_at = ?
       WHERE user_id = ?`
    )
      .bind(Math.floor(Date.now() / 1000), userId)
      .run();

    return new Response(
      JSON.stringify({ message: 'Google Calendar disconnected' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
}
