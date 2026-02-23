/**
 * 暗号化・復号化ユーティリティ
 *
 * AES-256-GCM を使用してユーザーの認証情報（Slack/Notion）を暗号化する
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits (GCM recommended)

/**
 * テキストを AES-256-GCM で暗号化する
 *
 * @param plaintext - 暗号化する平文
 * @param encryptionKey - 暗号化キー（base64エンコード済み）
 * @returns 暗号化されたテキスト（IV + 暗号文、base64エンコード）
 */
export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  // IV（初期化ベクトル）を生成
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // 暗号化キーをインポート
  const key = await importKey(encryptionKey);

  // 平文をエンコード
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // 暗号化
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );

  // IV + 暗号文を結合
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Base64 エンコードして返す
  return base64Encode(combined);
}

/**
 * AES-256-GCM で暗号化されたテキストを復号化する
 *
 * @param ciphertext - 暗号化されたテキスト（IV + 暗号文、base64エンコード）
 * @param encryptionKey - 暗号化キー（base64エンコード済み）
 * @returns 復号化された平文
 */
export async function decrypt(ciphertext: string, encryptionKey: string): Promise<string> {
  // Base64 デコード
  const combined = base64Decode(ciphertext);

  // IV と暗号文を分離
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);

  // 暗号化キーをインポート
  const key = await importKey(encryptionKey);

  // 復号化
  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );

  // デコードして文字列に変換
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * 新しい暗号化キーを生成する（セットアップ時に使用）
 *
 * @returns Base64 エンコードされた暗号化キー
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  ) as CryptoKey;

  const exported = await crypto.subtle.exportKey('raw', key) as ArrayBuffer;
  return base64Encode(new Uint8Array(exported));
}

/**
 * Base64 エンコードされたキーをインポートする
 */
async function importKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64Decode(base64Key);

  return crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Base64 エンコード
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
