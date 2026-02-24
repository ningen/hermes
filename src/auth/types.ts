/**
 * 認証関連の型定義
 */

/**
 * ユーザー情報
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * ユーザー設定（復号化済み）
 */
export interface UserSettings {
  id: string;
  userId: string;
  slackWebhookUrl: string | null;
  notionApiKey: string | null;
  notionDatabaseId: string | null;
  /** Slack インバウンド: Bot User OAuth Token (xoxb-...) */
  slackBotToken: string | null;
  /** Slack インバウンド: Slack App の Signing Secret */
  slackSigningSecret: string | null;
  /** Slack インバウンド: Webhook URL に使うユーザー固有トークン（UUID） */
  slackInboundToken: string | null;
  /** Slack インバウンド: 許可する Slack User ID（カンマ区切り） */
  slackAllowedUserIds: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * メールルート情報
 */
export interface EmailRoute {
  id: string;
  emailAddress: string;
  userId: string;
  isActive: boolean;
  createdAt: number;
}

/**
 * JWT ペイロード
 */
export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;  // issued at
  exp: number;  // expiration
}

/**
 * セッション情報（KV に保存）
 */
export interface SessionData {
  userId: string;
  email: string;
  createdAt: number;
}

/**
 * 認証済みリクエスト（ミドルウェアで userId を追加）
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
}
