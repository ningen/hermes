/**
 * 事前フィルタ
 *
 * Gemini API 消費を抑えるため、明らかに不要なメールをルールベースで弾く。
 */
import type { ParsedEmail } from '../utils/types.js';

/**
 * スパムとして扱うドメインのブラックリスト
 * 必要に応じて追加する。
 */
const DOMAIN_BLACKLIST = new Set([
  'spam-domain.example.com',
  'mailer-daemon.example.com',
]);

/**
 * ニュースレター系の件名キーワード（小文字で比較）
 */
const NEWSLETTER_KEYWORDS = [
  'newsletter',
  'unsubscribe',
  'メールマガジン',
  '配信停止',
  '登録解除',
  '週刊',
  '月刊',
];

/**
 * 事前フィルタの判定結果
 */
export interface PrefilterResult {
  /** フィルタを通過したか */
  pass: boolean;
  /** スキップした場合の理由 */
  reason?: string;
}

/**
 * メールを事前フィルタにかける。
 *
 * @param email - パース済みメール情報
 * @returns フィルタ結果
 */
export function applyPrefilter(email: ParsedEmail): PrefilterResult {
  // 1. from ドメインのブラックリスト確認
  const fromDomain = extractDomain(email.from);
  if (fromDomain && DOMAIN_BLACKLIST.has(fromDomain)) {
    return { pass: false, reason: `Blacklisted domain: ${fromDomain}` };
  }

  // 2. noreply アドレスの確認
  const fromLower = email.from.toLowerCase();
  if (fromLower.includes('noreply@') || fromLower.includes('no-reply@')) {
    return { pass: false, reason: 'No-reply address' };
  }

  // 3. 件名が空
  if (!email.subject || email.subject.trim() === '') {
    return { pass: false, reason: 'Empty subject' };
  }

  // 4. 本文が短くかつニュースレター系キーワードが件名に含まれる
  if (email.body.length < 100) {
    const subjectLower = email.subject.toLowerCase();
    const isNewsletter = NEWSLETTER_KEYWORDS.some(kw => subjectLower.includes(kw));
    if (isNewsletter) {
      return { pass: false, reason: 'Short body with newsletter keyword' };
    }
  }

  return { pass: true };
}

/**
 * メールアドレスからドメイン部分を抽出する。
 *
 * @param address - メールアドレス（例: "Sender Name <sender@example.com>" や "sender@example.com"）
 * @returns ドメイン文字列、または null
 */
function extractDomain(address: string): string | null {
  // "Display Name <email@domain.com>" 形式に対応
  const match = address.match(/<([^>]+)>/) ?? address.match(/([^\s]+)/);
  if (!match) return null;
  const email = match[1];
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return null;
  return email.slice(atIndex + 1).toLowerCase();
}
