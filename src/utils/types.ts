/**
 * 共通型定義
 */

/**
 * Cloudflare Workers の環境変数バインディング
 */
export interface Env {
  DB: D1Database;
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  FROM_ADDRESS: string;
  GEMINI_API_KEY: string;
  SLACK_WEBHOOK_URL: string;
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  ENVIRONMENT: string;
}

/**
 * パース済みメール情報
 */
export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId: string;
  timestamp: number;
}

/**
 * Mailgun のリクエストボディ（multipart/form-data）
 */
export interface MailgunPayload {
  timestamp: string;
  token: string;
  signature: string;
  sender: string;
  recipient: string;
  subject: string;
  'body-plain': string;
  'body-html'?: string;
  'Message-Id'?: string;
}

/**
 * 処理ログのステータス
 */
export type MailLogStatus = 'processed' | 'filtered' | 'error';
