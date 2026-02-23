/**
 * 認証ミドルウェア
 *
 * HTTP リクエストから JWT を検証し、ユーザー情報を抽出する
 */

import type { Env } from '../utils/types.js';
import { verifyJWT } from './jwt.js';
import { getSession } from './session.js';

/**
 * 認証が必要なエンドポイント用ミドルウェア
 *
 * Authorization ヘッダーから JWT を取得し、検証する
 *
 * @param request - HTTP リクエスト
 * @param env - 環境変数バインディング
 * @returns ユーザーID（検証成功時）、null（検証失敗時）
 */
export async function authenticate(request: Request, env: Env): Promise<string | null> {
  // Authorization ヘッダーを取得
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Bearer トークンを抽出
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return null;
  }

  const token = match[1];

  // JWT を検証
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return null;
  }

  // KV セッションを確認（オプション: より厳密な検証）
  if (env.SESSIONS) {
    const session = await getSession(env.SESSIONS, token);
    if (!session || session.userId !== payload.userId) {
      console.warn('[middleware] Session mismatch or not found');
      return null;
    }
  }

  return payload.userId;
}

/**
 * 認証が必須のエンドポイントのラッパー
 *
 * @param request - HTTP リクエスト
 * @param env - 環境変数バインディング
 * @param handler - 認証成功時に実行するハンドラ（userId を受け取る）
 * @returns HTTP レスポンス
 */
export async function requireAuth(
  request: Request,
  env: Env,
  handler: (userId: string) => Promise<Response>
): Promise<Response> {
  const userId = await authenticate(request, env);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return handler(userId);
}
