/**
 * 認証 API エンドポイント
 */

import type { Env } from '../utils/types.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password.js';
import { generateJWT } from '../auth/jwt.js';
import { saveSession, deleteSession } from '../auth/session.js';
import { createUser, findUserByEmail, findUserById } from '../db/users.js';
import { requireAuth } from '../auth/middleware.js';
import { createEmailRoute } from '../db/routes.js';

/**
 * POST /api/auth/register
 * ユーザー登録
 */
export async function handleAuthRegister(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      email?: string;
      password?: string;
      name?: string;
    };

    // バリデーション
    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // パスワード強度チェック
    const passwordError = validatePasswordStrength(body.password);
    if (passwordError) {
      return new Response(
        JSON.stringify({ error: passwordError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 既存ユーザーチェック
    const existingUser = await findUserByEmail(env.DB, body.email);
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(body.password);

    // ユーザーを作成
    const userId = crypto.randomUUID();
    const user = await createUser(env.DB, userId, body.email, passwordHash, body.name || null);

    // email route を作成
    // TODO: 本当は、UUID をさらにhash にしたりしたほうがいいかも?
    const emailPrefix = crypto.randomUUID()
    await createEmailRoute(env.DB, `${emailPrefix}@${env.MAILGUN_DOMAIN}`, user.id)

    // JWT を生成
    const token = await generateJWT(user.id, user.email, env.JWT_SECRET);

    // セッションを保存（KV が有効な場合）
    if (env.SESSIONS) {
      await saveSession(env.SESSIONS, token, {
        userId: user.id,
        email: user.email,
        createdAt: Math.floor(Date.now() / 1000),
      });
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[auth/register] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/auth/login
 * ログイン
 */
export async function handleAuthLogin(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      email?: string;
      password?: string;
    };

    // バリデーション
    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ユーザーを検索
    const user = await findUserByEmail(env.DB, body.email);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // パスワードを検証
    const isValid = await verifyPassword(body.password, user.passwordHash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // JWT を生成
    const token = await generateJWT(user.id, user.email, env.JWT_SECRET);

    // セッションを保存（KV が有効な場合）
    if (env.SESSIONS) {
      await saveSession(env.SESSIONS, token, {
        userId: user.id,
        email: user.email,
        createdAt: Math.floor(Date.now() / 1000),
      });
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[auth/login] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/auth/me
 * 現在のユーザー情報を取得
 */
export async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId: string) => {
    try {
      const user = await findUserById(env.DB, userId);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('[auth/me] Error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
}

/**
 * POST /api/auth/logout
 * ログアウト
 */
export async function handleAuthLogout(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (_userId: string) => {
    try {
      // Authorization ヘッダーからトークンを取得
      const authHeader = request.headers.get('Authorization');
      const match = authHeader?.match(/^Bearer\s+(.+)$/);

      if (match && env.SESSIONS) {
        const token = match[1];
        await deleteSession(env.SESSIONS, token);
      }

      return new Response(
        JSON.stringify({ message: 'Logged out successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('[auth/logout] Error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
}
