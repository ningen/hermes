/**
 * Google カレンダー イベント作成アクション
 *
 * Google Calendar API v3 を使用してカレンダーにイベントを追加する。
 * OAuth2 のリフレッシュトークンでアクセストークンを取得して使用する。
 */
import type { CreateScheduleAction, ActionResult } from './types.js';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GoogleCalendarEvent {
  id: string;
  htmlLink: string;
}

/**
 * リフレッシュトークンを使ってアクセストークンを取得する
 */
async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await response.json() as GoogleTokenResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Google token refresh failed: ${data.error ?? response.status} - ${data.error_description ?? ''}`
    );
  }

  return data.access_token;
}

/**
 * Google カレンダーにイベントを作成する。
 *
 * @param action       - create_schedule アクション
 * @param refreshToken - Google OAuth2 リフレッシュトークン
 * @param calendarId   - 登録先カレンダー ID（デフォルト: "primary"）
 * @param clientId     - Google OAuth クライアント ID
 * @param clientSecret - Google OAuth クライアントシークレット
 * @returns アクション実行結果
 */
export async function createGoogleCalendarEvent(
  action: CreateScheduleAction,
  refreshToken: string,
  calendarId: string,
  clientId: string,
  clientSecret: string
): Promise<ActionResult> {
  try {
    console.log('[google_calendar] Creating event:', {
      title: action.params.title,
      startTime: action.params.startTime,
      endTime: action.params.endTime,
      calendarId,
    });

    // アクセストークンを取得
    const accessToken = await getAccessToken(refreshToken, clientId, clientSecret);

    // イベントペイロードを構築
    // startTime / endTime が日付のみ（YYYY-MM-DD）の場合は "date" フィールドで終日イベントとして扱う
    const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(action.params.startTime);

    const eventPayload = {
      summary: action.params.title,
      description: action.params.description ?? undefined,
      start: isAllDay
        ? { date: action.params.startTime }
        : { dateTime: action.params.startTime },
      end: isAllDay
        ? { date: action.params.endTime ?? action.params.startTime }
        : { dateTime: action.params.endTime ?? action.params.startTime },
    };

    // Google Calendar API を呼び出し
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: 'create_schedule',
        success: false,
        error: `Google Calendar API error: ${response.status} ${errorText}`,
      };
    }

    const result = await response.json() as GoogleCalendarEvent;
    console.log('[google_calendar] Event created:', result.id, result.htmlLink);

    return { type: 'create_schedule', success: true };
  } catch (err) {
    return {
      type: 'create_schedule',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
