/**
 * メールルーティングテーブル操作
 */

import type { EmailRoute } from '../auth/types.js';

/**
 * メールルートを作成する
 *
 * @param db - D1Database バインディング
 * @param emailAddress - メールアドレス
 * @param userId - ユーザーID
 * @returns 作成されたメールルート
 */
export async function createEmailRoute(
  db: D1Database,
  emailAddress: string,
  userId: string
): Promise<EmailRoute> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO email_routes (id, email_address, user_id, is_active, created_at)
       VALUES (?, ?, ?, 1, ?)`
    )
    .bind(id, emailAddress, userId, now)
    .run();

  return {
    id,
    emailAddress,
    userId,
    isActive: true,
    createdAt: now,
  };
}

/**
 * メールアドレスでルートを検索する
 *
 * @param db - D1Database バインディング
 * @param emailAddress - メールアドレス
 * @returns メールルート情報（見つからない場合は null）
 */
export async function findEmailRoute(
  db: D1Database,
  emailAddress: string
): Promise<EmailRoute | null> {
  const result = await db
    .prepare(`SELECT * FROM email_routes WHERE email_address = ?`)
    .bind(emailAddress)
    .first<{
      id: string;
      email_address: string;
      user_id: string;
      is_active: number;
      created_at: number;
    }>();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    emailAddress: result.email_address,
    userId: result.user_id,
    isActive: result.is_active === 1,
    createdAt: result.created_at,
  };
}

/**
 * ユーザーIDでメールルートを取得する
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 * @returns メールルートのリスト
 */
export async function getEmailRoutesByUserId(
  db: D1Database,
  userId: string
): Promise<EmailRoute | null> {
  const result = await db
    .prepare(`SELECT * FROM email_routes WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(userId)
    .first<{
      id: string;
      email_address: string;
      user_id: string;
      is_active: number;
      created_at: number;
    }>();

  if (!result) {
    return null
  }

  return {
    id: result.id,
    emailAddress: result.email_address,
    userId: result.user_id,
    isActive: result.is_active === 1,
    createdAt: result.created_at
  };
}

/**
 * メールルートのアクティブ状態を更新する
 *
 * @param db - D1Database バインディング
 * @param routeId - メールルートID
 * @param isActive - アクティブ状態
 */
export async function updateEmailRouteStatus(
  db: D1Database,
  routeId: string,
  isActive: boolean
): Promise<void> {
  await db
    .prepare(`UPDATE email_routes SET is_active = ? WHERE id = ?`)
    .bind(isActive ? 1 : 0, routeId)
    .run();
}

/**
 * メールルートを削除する
 *
 * @param db - D1Database バインディング
 * @param routeId - メールルートID
 */
export async function deleteEmailRoute(db: D1Database, routeId: string): Promise<void> {
  await db.prepare(`DELETE FROM email_routes WHERE id = ?`).bind(routeId).run();
}
