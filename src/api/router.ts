/**
 * API ルーター
 *
 * URL パスに基づいて適切なハンドラーにルーティングする
 */

import type { Env } from '../utils/types.js';
import { handleAuthRegister, handleAuthLogin, handleAuthMe, handleAuthLogout } from './auth.js';
import { handleGetEmailRoute } from './emailRoute.js';
import { handleGetSettings, handleUpdateSettings } from './settings.js';

/**
 * API リクエストをルーティングする
 *
 * @param request - HTTP リクエスト
 * @param env - 環境変数バインディング
 * @returns HTTP レスポンス
 */
export async function routeAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS ヘッダーを追加
  const corsHeaders = getCORSHeaders(request);

  // OPTIONS リクエスト（プリフライト）に対応
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    let response: Response;

    // 認証エンドポイント
    if (path === '/api/auth/register' && method === 'POST') {
      response = await handleAuthRegister(request, env);
    } else if (path === '/api/auth/login' && method === 'POST') {
      response = await handleAuthLogin(request, env);
    } else if (path === '/api/auth/me' && method === 'GET') {
      response = await handleAuthMe(request, env);
    } else if (path === '/api/auth/logout' && method === 'POST') {
      response = await handleAuthLogout(request, env);
    }
    // 設定エンドポイント
    else if (path === '/api/settings' && method === 'GET') {
      response = await handleGetSettings(request, env);
    } else if (path === '/api/settings' && method === 'PUT') {
      response = await handleUpdateSettings(request, env);
    }

    // email route
    else if (path === '/email-route' && method === 'GET') {
      response = await handleGetEmailRoute(request, env);
    }

    // 404
    else {
      response = new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CORS ヘッダーを追加
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (err) {
    console.error('[router] Error:', err);
    const response = new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}

/**
 * CORS ヘッダーを生成する
 */
function getCORSHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
