/**
 * Cloudflare Workers エントリーポイント
 *
 * hermes - 受信メール処理エージェント
 */
import type { Env } from './utils/types.js';
import { handleInbound } from './handlers/inbound.js';
import { routeAPI } from './api/router.js';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  /**
   * すべての受信 HTTP リクエストを処理する。
   *
   * @param request - HTTP リクエスト
   * @param env     - Cloudflare Workers 環境変数・バインディング
   * @param ctx     - ExecutionContext
   * @returns HTTP レスポンス
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API エンドポイント
    if (url.pathname.startsWith('/api/')) {
      return routeAPI(request, env);
    }

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

    // 静的ファイル配信（Workers Sites）
    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: __STATIC_CONTENT_MANIFEST,
        }
      );
    } catch (err) {
      // 404の場合、SPAのためindex.htmlを返す
      if ((err as { status?: number }).status === 404) {
        try {
          return await getAssetFromKV(
            {
              request: new Request(`${url.origin}/index.html`, request),
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: __STATIC_CONTENT_MANIFEST,
            }
          );
        } catch (e) {
          return new Response('Not Found', { status: 404 });
        }
      }

      return new Response('Internal Server Error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
