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
    slackBotToken?: string | null;
    slackSigningSecret?: string | null;
    slackInboundToken?: string | null;
    slackAllowedUserIds?: string | null;
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
  const encryptedBotToken = settings.slackBotToken
    ? await encrypt(settings.slackBotToken, encryptionKey)
    : null;
  const encryptedSigningSecret = settings.slackSigningSecret
    ? await encrypt(settings.slackSigningSecret, encryptionKey)
    : null;

  // 既存設定を確認
  const existing = await db
    .prepare(`SELECT id, slack_inbound_token FROM user_settings WHERE user_id = ?`)
    .bind(userId)
    .first<{ id: string; slack_inbound_token: string | null }>();

  // inbound_token は新規作成時に自動生成し、既存の場合は引数がなければ保持
  const inboundToken =
    settings.slackInboundToken !== undefined
      ? settings.slackInboundToken
      : existing?.slack_inbound_token ?? null;

  // Signing Secret が設定されているのに inbound_token がない場合は自動生成
  const resolvedInboundToken =
    inboundToken ?? (settings.slackSigningSecret ? crypto.randomUUID() : null);

  if (existing) {
    // 更新
    await db
      .prepare(
        `UPDATE user_settings
         SET slack_webhook_url = ?, notion_api_key = ?, notion_database_id = ?,
             slack_bot_token = ?, slack_signing_secret = ?,
             slack_inbound_token = ?, slack_allowed_user_ids = ?,
             updated_at = ?
         WHERE user_id = ?`
      )
      .bind(
        encryptedSlack, encryptedNotion, encryptedDatabase,
        encryptedBotToken, encryptedSigningSecret,
        resolvedInboundToken, settings.slackAllowedUserIds ?? null,
        now, userId
      )
      .run();

    return {
      id: existing.id,
      userId,
      slackWebhookUrl: settings.slackWebhookUrl ?? null,
      notionApiKey: settings.notionApiKey ?? null,
      notionDatabaseId: settings.notionDatabaseId ?? null,
      slackBotToken: settings.slackBotToken ?? null,
      slackSigningSecret: settings.slackSigningSecret ?? null,
      slackInboundToken: resolvedInboundToken,
      slackAllowedUserIds: settings.slackAllowedUserIds ?? null,
      createdAt: 0,
      updatedAt: now,
    };
  } else {
    // 新規作成
    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO user_settings (
           id, user_id,
           slack_webhook_url, notion_api_key, notion_database_id,
           slack_bot_token, slack_signing_secret,
           slack_inbound_token, slack_allowed_user_ids,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id, userId,
        encryptedSlack, encryptedNotion, encryptedDatabase,
        encryptedBotToken, encryptedSigningSecret,
        resolvedInboundToken, settings.slackAllowedUserIds ?? null,
        now, now
      )
      .run();

    return {
      id,
      userId,
      slackWebhookUrl: settings.slackWebhookUrl ?? null,
      notionApiKey: settings.notionApiKey ?? null,
      notionDatabaseId: settings.notionDatabaseId ?? null,
      slackBotToken: settings.slackBotToken ?? null,
      slackSigningSecret: settings.slackSigningSecret ?? null,
      slackInboundToken: resolvedInboundToken,
      slackAllowedUserIds: settings.slackAllowedUserIds ?? null,
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
      slack_bot_token: string | null;
      slack_signing_secret: string | null;
      slack_inbound_token: string | null;
      slack_allowed_user_ids: string | null;
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
  const slackBotToken = result.slack_bot_token
    ? await decrypt(result.slack_bot_token, encryptionKey)
    : null;
  const slackSigningSecret = result.slack_signing_secret
    ? await decrypt(result.slack_signing_secret, encryptionKey)
    : null;

  return {
    id: result.id,
    userId: result.user_id,
    slackWebhookUrl,
    notionApiKey,
    notionDatabaseId,
    slackBotToken,
    slackSigningSecret,
    slackInboundToken: result.slack_inbound_token,
    slackAllowedUserIds: result.slack_allowed_user_ids,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * Slack インバウンドトークンからユーザー設定を取得する（復号化済み）
 *
 * @param db - D1Database バインディング
 * @param token - slack_inbound_token の値
 * @param encryptionKey - 暗号化キー
 * @returns ユーザー設定（見つからない場合は null）
 */
export async function getUserSettingsBySlackToken(
  db: D1Database,
  token: string,
  encryptionKey: string
): Promise<UserSettings | null> {
  const result = await db
    .prepare(`SELECT user_id FROM user_settings WHERE slack_inbound_token = ?`)
    .bind(token)
    .first<{ user_id: string }>();

  if (!result) {
    return null;
  }

  return getUserSettings(db, result.user_id, encryptionKey);
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
