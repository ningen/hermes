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
  userId?: string | null;  // ユーザーID（オプション、マルチユーザー対応）
}

export interface MailLogRow {
  id: string;
  receivedAt: number;
  fromAddr: string;
  toAddr: string;
  subject: string | null;
  understanding: string | null;
  actionsTaken: ActionResult[] | null;
  status: MailLogStatus;
  errorMessage: string | null;
  userId: string | null;
}

/**
 * ユーザーのメール処理ログ一覧を D1 から取得する。
 */
export async function getMailLogsByUserId(
  db: D1Database,
  userId: string,
  options: { limit?: number; offset?: number; status?: string } = {}
): Promise<{ logs: MailLogRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const statusFilter = options.status ? ' AND status = ?' : '';
  const baseParams: unknown[] = [userId];
  if (options.status) baseParams.push(options.status);

  const [rows, countRow] = await Promise.all([
    db
      .prepare(
        `SELECT id, received_at, from_addr, to_addr, subject, understanding, actions_taken, status, error_message, user_id
         FROM mail_logs WHERE user_id = ?${statusFilter}
         ORDER BY received_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...baseParams, limit, offset)
      .all<Record<string, unknown>>(),
    db
      .prepare(`SELECT COUNT(*) as count FROM mail_logs WHERE user_id = ?${statusFilter}`)
      .bind(...baseParams)
      .first<{ count: number }>(),
  ]);

  const logs: MailLogRow[] = (rows.results ?? []).map((row) => ({
    id: row.id as string,
    receivedAt: row.received_at as number,
    fromAddr: row.from_addr as string,
    toAddr: row.to_addr as string,
    subject: row.subject as string | null,
    understanding: row.understanding as string | null,
    actionsTaken: row.actions_taken
      ? (JSON.parse(row.actions_taken as string) as ActionResult[])
      : null,
    status: row.status as MailLogStatus,
    errorMessage: row.error_message as string | null,
    userId: row.user_id as string | null,
  }));

  return { logs, total: countRow?.count ?? 0 };
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
        (id, received_at, from_addr, to_addr, subject, understanding, actions_taken, status, error_message, user_id)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      data.errorMessage,
      data.userId ?? null
    )
    .run();
}
