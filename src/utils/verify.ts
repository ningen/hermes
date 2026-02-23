/**
 * Mailgun 署名検証
 */

/**
 * Mailgun から送られた webhook の署名を HMAC-SHA256 で検証する。
 *
 * @param timestamp - Mailgun が付与するタイムスタンプ文字列
 * @param token     - Mailgun が付与するランダムトークン
 * @param signature - Mailgun が付与する署名（16進数文字列）
 * @param apiKey    - Mailgun API キー（signing key）
 * @returns 署名が正当であれば true
 */
export async function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  apiKey: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + token);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return computedSignature === signature;
}
