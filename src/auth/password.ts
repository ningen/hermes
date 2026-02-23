/**
 * パスワードハッシュ化・検証ユーティリティ
 *
 * Cloudflare Workers では Argon2id が利用できないため、
 * PBKDF2-SHA256 を使用（600,000 iterations で強度を確保）
 */

const ITERATIONS = 600000; // OWASP 推奨値（2023年以降）
const HASH_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

/**
 * パスワードをハッシュ化する
 *
 * @param password - プレーンテキストパスワード
 * @returns ハッシュ化されたパスワード（salt含む、base64エンコード）
 */
export async function hashPassword(password: string): Promise<string> {
  // ランダムなソルトを生成
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // パスワードをエンコード
  const passwordBuffer = new TextEncoder().encode(password);

  // PBKDF2 でハッシュ化
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  const hash = new Uint8Array(hashBuffer);

  // salt + hash を結合して base64 エンコード
  const combined = new Uint8Array(salt.length + hash.length);
  combined.set(salt);
  combined.set(hash, salt.length);

  return base64Encode(combined);
}

/**
 * パスワードを検証する
 *
 * @param password - プレーンテキストパスワード
 * @param hash - ハッシュ化されたパスワード（salt含む）
 * @returns パスワードが一致する場合 true
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // base64 デコード
    const combined = base64Decode(hash);

    // salt と hash を分離
    const salt = combined.slice(0, SALT_LENGTH);
    const originalHash = combined.slice(SALT_LENGTH);

    // 入力パスワードをハッシュ化
    const passwordBuffer = new TextEncoder().encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      HASH_LENGTH * 8
    );

    const computedHash = new Uint8Array(hashBuffer);

    // タイミング攻撃を防ぐために constant-time comparison
    return constantTimeEqual(originalHash, computedHash);
  } catch (err) {
    console.error('[password] Verification error:', err);
    return false;
  }
}

/**
 * パスワードの強度を検証する
 *
 * @param password - 検証するパスワード
 * @returns 有効な場合 null、無効な場合はエラーメッセージ
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return 'Password must be at least 12 characters long';
  }

  if (password.length > 128) {
    return 'Password must be less than 128 characters';
  }

  // 少なくとも1つの数字、1つの大文字、1つの小文字を含む
  const hasNumber = /\d/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);

  if (!hasNumber || !hasUpperCase || !hasLowerCase) {
    return 'Password must contain at least one number, one uppercase letter, and one lowercase letter';
  }

  return null;
}

/**
 * Base64 エンコード（URL-safe でない標準版）
 */
function base64Encode(buffer: Uint8Array): string {
  const binary = Array.from(buffer)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return btoa(binary);
}

/**
 * Base64 デコード
 */
function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Constant-time comparison（タイミング攻撃対策）
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
