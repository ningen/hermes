/**
 * API ルーター
 *
 * URL パスに基づいて適切なハンドラーにルーティングする
 */

import type { Env } from '../utils/types.js';
import { handleAuthRegister, handleAuthLogin, handleAuthMe, handleAuthLogout } from './auth.js';
import { handleGetEmailRoute } from './emailRoute.js';
import { handleGetSettings, handleUpdateSettings } from './settings.js';
import {
  handleListTools,
  handleListWorkflows,
  handleCreateWorkflow,
  handleGetWorkflow,
  handleUpdateWorkflow,
  handleDeleteWorkflow,
} from './workflows.js';
import { handleListLogs } from './logs.js';
import {
  handleUploadTranscription,
  handleListTranscriptions,
  handleGetTranscription,
  handleDeleteTranscription,
  handleExtractSchedules,
  handleCreateScheduleFromTranscription,
} from './transcriptions.js';

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
    else if (path === '/api/email-route' && method === 'GET') {
      response = await handleGetEmailRoute(request, env);
    }
    // ログ一覧
    else if (path === '/api/logs' && method === 'GET') {
      response = await handleListLogs(request, env);
    }
    // ツール一覧（認証不要）
    else if (path === '/api/tools' && method === 'GET') {
      response = await handleListTools(request, env);
    }
    // ワークフロー
    else if (path === '/api/workflows' && method === 'GET') {
      response = await handleListWorkflows(request, env);
    } else if (path === '/api/workflows' && method === 'POST') {
      response = await handleCreateWorkflow(request, env);
    } else if (path.startsWith('/api/workflows/') && method === 'GET') {
      const id = path.split('/')[3];
      response = await handleGetWorkflow(request, env, id);
    } else if (path.startsWith('/api/workflows/') && method === 'PUT') {
      const id = path.split('/')[3];
      response = await handleUpdateWorkflow(request, env, id);
    } else if (path.startsWith('/api/workflows/') && method === 'DELETE') {
      const id = path.split('/')[3];
      response = await handleDeleteWorkflow(request, env, id);
    }
    // 文字起こし
    else if (path === '/api/transcriptions' && method === 'POST') {
      response = await handleUploadTranscription(request, env);
    } else if (path === '/api/transcriptions' && method === 'GET') {
      response = await handleListTranscriptions(request, env);
    } else if (path.match(/^\/api\/transcriptions\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[3];
      response = await handleGetTranscription(request, env, id);
    } else if (path.match(/^\/api\/transcriptions\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      response = await handleDeleteTranscription(request, env, id);
    } else if (path.match(/^\/api\/transcriptions\/[^/]+\/extract-schedules$/) && method === 'POST') {
      const id = path.split('/')[3];
      response = await handleExtractSchedules(request, env, id);
    } else if (path.match(/^\/api\/transcriptions\/[^/]+\/create-schedule$/) && method === 'POST') {
      const id = path.split('/')[3];
      response = await handleCreateScheduleFromTranscription(request, env, id);
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
