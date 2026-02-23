/**
 * 共通型定義
 */

/**
 * Cloudflare Workers の環境変数バインディング
 */
export interface Env {
  // NOTE: scheduled handler も同じ Env を使用する
  DB: D1Database;
  SESSIONS?: KVNamespace;              // セッション管理用 KV（オプション）
  __STATIC_CONTENT?: KVNamespace;      // Workers Sites 用 KV（自動バインド）
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  FROM_ADDRESS: string;
  GEMINI_API_KEY: string;
  JWT_SECRET: string;                  // JWT 署名用シークレット
  ENCRYPTION_KEY: string;              // 認証情報暗号化キー
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

/**
 * ワークフロー実行時にエージェントへ渡すコンテキスト
 */
export interface WorkflowContext {
  workflowId: string;
  workflowName: string;
  /** ユーザーが定義した「何をしてほしいか」の指示 */
  prompt: string;
  triggeredAt: number;
  /** 事前実行されたツールの出力（エージェントのコンテキストに注入される） */
  toolResults: Array<{
    toolId: string;
    toolName: string;
    content: string;
  }>;
}

/**
 * エージェントへの入力コンテキスト
 * メールとワークフローを統一的に扱う
 */
export type InputContext =
  | { type: 'email'; data: ParsedEmail }
  | { type: 'workflow'; data: WorkflowContext };
