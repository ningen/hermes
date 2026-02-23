/**
 * Cloudflare D1 操作
 */
import type { MailLogStatus } from '../utils/types.js';
import type { ActionResult } from '../actions/types.js';

/**
 * D1 に保存するメール処理ログのデータ
 */
export interface MailLogData {
  id: string;
  receivedAt: number;
  fromAddr: string;
  toAddr: string;
  subject: string | null;
  understanding: string | null;
  actionsTaken: ActionResult[] | null;
  status: MailLogStatus;
  errorMessage: string | null;
}

/**
 * メール処理ログを D1 に保存する。
 *
 * @param db   - D1Database バインディング
 * @param data - 保存するログデータ
 */
export async function saveMailLog(db: D1Database, data: MailLogData): Promise<void> {
  const actionsTakenJson = data.actionsTaken
    ? JSON.stringify(data.actionsTaken)
    : null;

  await db
    .prepare(
      `INSERT INTO mail_logs
        (id, received_at, from_addr, to_addr, subject, understanding, actions_taken, status, error_message)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.id,
      data.receivedAt,
      data.fromAddr,
      data.toAddr,
      data.subject,
      data.understanding,
      actionsTakenJson,
      data.status,
      data.errorMessage
    )
    .run();
}
