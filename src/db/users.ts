/**
 * ユーザーテーブル操作
 */

import type { User } from '../auth/types.js';

/**
 * ユーザーを作成する
 *
 * @param db - D1Database バインディング
 * @param id - ユーザーID（UUID）
 * @param email - メールアドレス
 * @param passwordHash - ハッシュ化されたパスワード
 * @param name - ユーザー名（オプション）
 * @returns 作成されたユーザー
 */
export async function createUser(
  db: D1Database,
  id: string,
  email: string,
  passwordHash: string,
  name: string | null = null
): Promise<User> {
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, email, passwordHash, name, now, now)
    .run();

  return {
    id,
    email,
    name,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * メールアドレスでユーザーを検索する
 *
 * @param db - D1Database バインディング
 * @param email - メールアドレス
 * @returns ユーザー情報（見つからない場合は null）
 */
export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<(User & { passwordHash: string }) | null> {
  const result = await db
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email)
    .first<{
      id: string;
      email: string;
      password_hash: string;
      name: string | null;
      created_at: number;
      updated_at: number;
    }>();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    email: result.email,
    passwordHash: result.password_hash,
    name: result.name,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * ユーザーIDでユーザーを検索する
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 * @returns ユーザー情報（見つからない場合は null）
 */
export async function findUserById(db: D1Database, userId: string): Promise<User | null> {
  const result = await db
    .prepare(`SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?`)
    .bind(userId)
    .first<{
      id: string;
      email: string;
      name: string | null;
      created_at: number;
      updated_at: number;
    }>();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    email: result.email,
    name: result.name,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * ユーザー情報を更新する
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 * @param updates - 更新する項目
 */
export async function updateUser(
  db: D1Database,
  userId: string,
  updates: { name?: string; passwordHash?: string }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }

  if (updates.passwordHash !== undefined) {
    fields.push('password_hash = ?');
    values.push(updates.passwordHash);
  }

  fields.push('updated_at = ?');
  values.push(now);

  values.push(userId);

  await db
    .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

/**
 * ユーザーを削除する
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
}
