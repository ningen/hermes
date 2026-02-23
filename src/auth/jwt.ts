/**
 * JWT 生成・検証ユーティリティ
 *
 * Cloudflare Workers の Web Crypto API を使用して HS256 (HMAC-SHA256) で署名
 */

import type { JWTPayload } from './types.js';

const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRY = 3600; // 1時間（秒）

/**
 * JWT を生成する
 *
 * @param userId - ユーザーID
 * @param email - メールアドレス
 * @param secret - JWT署名用シークレット
 * @returns JWT トークン
 */
export async function generateJWT(
  userId: string,
  email: string,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload: JWTPayload = {
    userId,
    email,
    iat: now,
    exp: now + JWT_EXPIRY,
  };

  const header = {
    alg: JWT_ALGORITHM,
    typ: 'JWT',
  };

  // Header と Payload を Base64URL エンコード
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const message = `${encodedHeader}.${encodedPayload}`;

  // HMAC-SHA256 で署名
  const signature = await sign(message, secret);
  const encodedSignature = base64UrlEncodeBuffer(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * JWT を検証する
 *
 * @param token - JWT トークン
 * @param secret - JWT署名用シークレット
 * @returns 検証成功時は JWTPayload、失敗時は null
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // 署名を検証
    const message = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await sign(message, secret);
    const expectedEncodedSignature = base64UrlEncodeBuffer(expectedSignature);

    if (!constantTimeEqual(encodedSignature, expectedEncodedSignature)) {
      console.warn('[jwt] Invalid signature');
      return null;
    }

    // Payload をデコード
    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload));

    // 有効期限をチェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.warn('[jwt] Token expired');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('[jwt] Verification error:', err);
    return null;
  }
}

/**
 * HMAC-SHA256 で署名する
 */
async function sign(message: string, secret: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return crypto.subtle.sign('HMAC', key, messageData);
}

/**
 * Base64URL エンコード（文字列）
 */
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return base64UrlEncodeBuffer(data);
}

/**
 * Base64URL エンコード（バッファ）
 */
function base64UrlEncodeBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const binary = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL デコード
 */
function base64UrlDecode(str: string): string {
  // Base64URL → Base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // パディング追加
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Constant-time 文字列比較（タイミング攻撃対策）
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
