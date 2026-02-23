/**
 * ユーザー設定テーブル操作
 *
 * 暗号化/復号化を含む
 */

import type { UserSettings } from '../auth/types.js';
import { encrypt, decrypt } from '../utils/crypto.js';

/**
 * ユーザー設定を作成または更新する
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 * @param settings - 設定データ（平文）
 * @param encryptionKey - 暗号化キー
 * @returns 保存された設定
 */
export async function saveUserSettings(
  db: D1Database,
  userId: string,
  settings: {
    slackWebhookUrl?: string | null;
    notionApiKey?: string | null;
    notionDatabaseId?: string | null;
  },
  encryptionKey: string
): Promise<UserSettings> {
  const now = Math.floor(Date.now() / 1000);

  // 各フィールドを暗号化（値が存在する場合のみ）
  const encryptedSlack = settings.slackWebhookUrl
    ? await encrypt(settings.slackWebhookUrl, encryptionKey)
    : null;
  const encryptedNotion = settings.notionApiKey
    ? await encrypt(settings.notionApiKey, encryptionKey)
    : null;
  const encryptedDatabase = settings.notionDatabaseId
    ? await encrypt(settings.notionDatabaseId, encryptionKey)
    : null;

  // 既存設定を確認
  const existing = await db
    .prepare(`SELECT id FROM user_settings WHERE user_id = ?`)
    .bind(userId)
    .first<{ id: string }>();

  if (existing) {
    // 更新
    await db
      .prepare(
        `UPDATE user_settings
         SET slack_webhook_url = ?, notion_api_key = ?, notion_database_id = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .bind(encryptedSlack, encryptedNotion, encryptedDatabase, now, userId)
      .run();

    return {
      id: existing.id,
      userId,
      slackWebhookUrl: settings.slackWebhookUrl ?? null,
      notionApiKey: settings.notionApiKey ?? null,
      notionDatabaseId: settings.notionDatabaseId ?? null,
      createdAt: 0, // 既存のタイムスタンプは取得しない
      updatedAt: now,
    };
  } else {
    // 新規作成
    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO user_settings (id, user_id, slack_webhook_url, notion_api_key, notion_database_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, encryptedSlack, encryptedNotion, encryptedDatabase, now, now)
      .run();

    return {
      id,
      userId,
      slackWebhookUrl: settings.slackWebhookUrl ?? null,
      notionApiKey: settings.notionApiKey ?? null,
      notionDatabaseId: settings.notionDatabaseId ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * ユーザー設定を取得する（復号化済み）
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 * @param encryptionKey - 暗号化キー
 * @returns ユーザー設定（見つからない場合は null）
 */
export async function getUserSettings(
  db: D1Database,
  userId: string,
  encryptionKey: string
): Promise<UserSettings | null> {
  const result = await db
    .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
    .bind(userId)
    .first<{
      id: string;
      user_id: string;
      slack_webhook_url: string | null;
      notion_api_key: string | null;
      notion_database_id: string | null;
      created_at: number;
      updated_at: number;
    }>();

  if (!result) {
    return null;
  }

  // 復号化
  const slackWebhookUrl = result.slack_webhook_url
    ? await decrypt(result.slack_webhook_url, encryptionKey)
    : null;
  const notionApiKey = result.notion_api_key
    ? await decrypt(result.notion_api_key, encryptionKey)
    : null;
  const notionDatabaseId = result.notion_database_id
    ? await decrypt(result.notion_database_id, encryptionKey)
    : null;

  return {
    id: result.id,
    userId: result.user_id,
    slackWebhookUrl,
    notionApiKey,
    notionDatabaseId,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * ユーザー設定を削除する
 *
 * @param db - D1Database バインディング
 * @param userId - ユーザーID
 */
export async function deleteUserSettings(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`DELETE FROM user_settings WHERE user_id = ?`).bind(userId).run();
}
