/**
 * ログ API エンドポイント
 *
 * GET /api/logs - メール処理ログ一覧取得
 */
import type { Env } from '../utils/types.js';
import { requireAuth } from '../auth/middleware.js';
import { getMailLogsByUserId } from '../db/d1.js';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// GET /api/logs
// ---------------------------------------------------------------------------

export async function handleListLogs(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const status = url.searchParams.get('status') ?? undefined;

      const { logs, total } = await getMailLogsByUserId(env.DB, userId, {
        limit,
        offset,
        status,
      });

      return json({ logs, total, limit, offset });
    } catch (err) {
      console.error('[logs/list] Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  });
}
