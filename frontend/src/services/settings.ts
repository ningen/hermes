/**
 * 設定 API サービス
 */

import { api } from './api';

export interface UserSettings {
  slackWebhookUrl: string | null;
  notionApiKey: string | null;
  notionDatabaseId: string | null;
  slackBotToken: string | null;
  slackSigningSecret: string | null;
  slackInboundToken: string | null;
  slackAllowedUserIds: string | null;
}

interface UpdateSettingsRequest {
  slackWebhookUrl?: string | null;
  notionApiKey?: string | null;
  notionDatabaseId?: string | null;
  slackBotToken?: string | null;
  slackSigningSecret?: string | null;
  slackAllowedUserIds?: string | null;
}

interface UpdateSettingsResponse {
  message: string;
  settings: UserSettings;
}

export async function getSettings(token: string): Promise<UserSettings> {
  return api.get<UserSettings>('/settings', token);
}

export async function updateSettings(
  token: string,
  settings: UpdateSettingsRequest
): Promise<UpdateSettingsResponse> {
  return api.put<UpdateSettingsResponse>('/settings', settings, token);
}
