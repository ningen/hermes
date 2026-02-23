/**
 * HTTPリクエストツール
 *
 * 任意のHTTPリクエストを実行してレスポンスをエージェントに渡す。
 * カスタムヘッダーやリクエストボディも設定可能。
 * 認証が必要なAPIや、POSTリクエストが必要なケースに対応する。
 */
import type { WorkflowTool, ToolResult } from './types.js';

/** レスポンス本文の最大文字数 */
const MAX_CONTENT_LENGTH = 8000;

/** タイムアウト（ミリ秒） */
const REQUEST_TIMEOUT_MS = 15000;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const ALLOWED_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export const httpRequestTool: WorkflowTool = {
  id: 'http_request',
  name: 'HTTPリクエスト',
  description: '任意のURLにHTTPリクエストを送信してレスポンスをエージェントに渡す（カスタムヘッダー・ボディ対応）',
  configSchema: [
    {
      key: 'url',
      label: 'URL',
      type: 'url',
      required: true,
      placeholder: 'https://api.example.com/data',
      description: 'リクエスト先のURL',
    },
    {
      key: 'method',
      label: 'メソッド',
      type: 'text',
      required: false,
      placeholder: 'GET',
      description: 'HTTPメソッド（GET / POST / PUT / PATCH / DELETE）デフォルト: GET',
    },
    {
      key: 'headers',
      label: 'ヘッダー（JSON）',
      type: 'textarea',
      required: false,
      placeholder: '{"Authorization": "Bearer YOUR_TOKEN", "Content-Type": "application/json"}',
      description: 'リクエストヘッダーをJSON形式で指定（省略可）',
    },
    {
      key: 'body',
      label: 'リクエストボディ',
      type: 'textarea',
      required: false,
      placeholder: '{"key": "value"}',
      description: 'POST/PUT/PATCH時のリクエストボディ（省略可）',
    },
  ],

  async execute(config): Promise<ToolResult> {
    const url = config['url'];
    if (!url) {
      return { success: false, content: '', error: 'URLが設定されていません' };
    }

    // メソッドの検証
    const rawMethod = (config['method'] ?? 'GET').trim().toUpperCase();
    if (!ALLOWED_METHODS.includes(rawMethod as HttpMethod)) {
      return {
        success: false,
        content: '',
        error: `未対応のHTTPメソッド: ${rawMethod}（使用可能: ${ALLOWED_METHODS.join(', ')}）`,
      };
    }
    const method = rawMethod as HttpMethod;

    // カスタムヘッダーのパース
    const customHeaders: Record<string, string> = {};
    const rawHeaders = config['headers']?.trim();
    if (rawHeaders) {
      try {
        const parsed = JSON.parse(rawHeaders);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
          return { success: false, content: '', error: 'ヘッダーはオブジェクト形式のJSONで指定してください' };
        }
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') customHeaders[k] = v;
        }
      } catch {
        return { success: false, content: '', error: 'ヘッダーのJSONパースに失敗しました。正しいJSON形式で入力してください' };
      }
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Hermes-Workflow-Agent/1.0',
      ...customHeaders,
    };

    const body = config['body']?.trim() || undefined;

    // GETにボディは付与しない
    const fetchInit: RequestInit = {
      method,
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(body && method !== 'GET' && method !== 'DELETE' ? { body } : {}),
    };

    let response: Response;
    try {
      response = await fetch(url, fetchInit);
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `リクエスト失敗: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const rawText = await response.text();

    // レスポンスを整形
    let content = rawText;
    if (contentType.includes('text/html')) {
      content = stripHtml(rawText);
    } else if (contentType.includes('application/json')) {
      // JSONは整形して読みやすくする
      try {
        content = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch {
        content = rawText;
      }
    }

    content = content.slice(0, MAX_CONTENT_LENGTH);

    const statusLine = `HTTP ${response.status} ${response.statusText}`;
    const resultHeader = [
      `【HTTPリクエスト結果】`,
      `${method} ${url}`,
      `ステータス: ${statusLine}`,
      `Content-Type: ${contentType || '(不明)'}`,
      '',
      content,
    ].join('\n');

    if (!response.ok) {
      return {
        success: false,
        content: resultHeader,
        error: `${statusLine}`,
      };
    }

    return { success: true, content: resultHeader };
  },
};

/** HTMLからタグを除去してプレーンテキストに変換する */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
