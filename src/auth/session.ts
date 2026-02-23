/**
 * セッション管理（Cloudflare Workers KV 使用）
 */

import type { SessionData } from './types.js';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 7 * 24 * 60 * 60; // 7日間（秒）

/**
 * セッションを保存する
 *
 * @param kv - KVNamespace バインディング
 * @param sessionId - セッションID（JWT トークン）
 * @param data - セッションデータ
 */
export async function saveSession(
  kv: KVNamespace,
  sessionId: string,
  data: SessionData
): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  await kv.put(key, JSON.stringify(data), {
    expirationTtl: SESSION_TTL,
  });
}

/**
 * セッションを取得する
 *
 * @param kv - KVNamespace バインディング
 * @param sessionId - セッションID（JWT トークン）
 * @returns セッションデータ、存在しない場合は null
 */
export async function getSession(
  kv: KVNamespace,
  sessionId: string
): Promise<SessionData | null> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const value = await kv.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SessionData;
  } catch (err) {
    console.error('[session] Failed to parse session data:', err);
    return null;
  }
}

/**
 * セッションを削除する
 *
 * @param kv - KVNamespace バインディング
 * @param sessionId - セッションID（JWT トークン）
 */
export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  await kv.delete(key);
}
