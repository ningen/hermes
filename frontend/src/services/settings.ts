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
  googleConnected: boolean;
  googleCalendarId: string | null;
}

interface UpdateSettingsRequest {
  slackWebhookUrl?: string | null;
  notionApiKey?: string | null;
  notionDatabaseId?: string | null;
  slackBotToken?: string | null;
  slackSigningSecret?: string | null;
  slackAllowedUserIds?: string | null;
  googleCalendarId?: string | null;
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

export async function getGoogleAuthUrl(token: string): Promise<{ url: string }> {
  return api.get<{ url: string }>('/auth/google/url', token);
}

export async function disconnectGoogle(token: string): Promise<void> {
  await api.delete('/auth/google', token);
}
