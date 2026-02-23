/**
 * Cloudflare Workers エントリーポイント
 *
 * hermes - 受信メール処理エージェント
 */
import type { Env } from './utils/types.js';
import { handleInbound } from './handlers/inbound.js';

export default {
  /**
   * すべての受信 HTTP リクエストを処理する。
   *
   * @param request - HTTP リクエスト
   * @param env     - Cloudflare Workers 環境変数・バインディング
   * @param _ctx    - ExecutionContext（現時点では未使用）
   * @returns HTTP レスポンス
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Mailgun Inbound Parse のエンドポイント
    if (request.method === 'POST' && url.pathname === '/inbound') {
      return handleInbound(request, env);
    }

    // ヘルスチェック
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'hermes' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
