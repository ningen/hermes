/**
 * 設定 API エンドポイント
 */

import type { Env } from '../utils/types.js';
import { requireAuth } from '../auth/middleware.js';
import { getUserSettings, saveUserSettings } from '../db/settings.js';

/**
 * GET /api/settings
 * ユーザー設定を取得
 */
export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId: string) => {
    try {
      const settings = await getUserSettings(env.DB, userId, env.ENCRYPTION_KEY);

      if (!settings) {
        // 設定が存在しない場合は空の設定を返す
        return new Response(
          JSON.stringify({
            slackWebhookUrl: null,
            notionApiKey: null,
            notionDatabaseId: null,
            slackBotToken: null,
            slackSigningSecret: null,
            slackInboundToken: null,
            slackAllowedUserIds: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          slackWebhookUrl: settings.slackWebhookUrl,
          notionApiKey: settings.notionApiKey,
          notionDatabaseId: settings.notionDatabaseId,
          slackBotToken: settings.slackBotToken,
          slackSigningSecret: settings.slackSigningSecret,
          slackInboundToken: settings.slackInboundToken,
          slackAllowedUserIds: settings.slackAllowedUserIds,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('[settings/get] Error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
}

/**
 * PUT /api/settings
 * ユーザー設定を更新
 */
export async function handleUpdateSettings(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId: string) => {
    try {
      const body = await request.json() as {
        slackWebhookUrl?: string | null;
        notionApiKey?: string | null;
        notionDatabaseId?: string | null;
        slackBotToken?: string | null;
        slackSigningSecret?: string | null;
        slackAllowedUserIds?: string | null;
      };

      // 設定を保存
      const settings = await saveUserSettings(env.DB, userId, body, env.ENCRYPTION_KEY);

      return new Response(
        JSON.stringify({
          message: 'Settings updated successfully',
          settings: {
            slackWebhookUrl: settings.slackWebhookUrl,
            notionApiKey: settings.notionApiKey,
            notionDatabaseId: settings.notionDatabaseId,
            slackBotToken: settings.slackBotToken,
            slackSigningSecret: settings.slackSigningSecret,
            slackInboundToken: settings.slackInboundToken,
            slackAllowedUserIds: settings.slackAllowedUserIds,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('[settings/update] Error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
}
