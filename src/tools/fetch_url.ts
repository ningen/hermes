/**
 * URL取得ツール
 *
 * 指定したURLのコンテンツを取得し、テキストとしてエージェントに渡す。
 * HTMLはタグを除去して平文に変換する。
 */
import type { WorkflowTool, ToolResult } from './types.js';

/** 取得コンテンツの最大文字数 */
const MAX_CONTENT_LENGTH = 5000;

export const fetchUrlTool: WorkflowTool = {
  id: 'fetch_url',
  name: 'URL取得',
  description: '指定したURLのコンテンツを取得してエージェントに渡す（HTML・JSON・テキスト対応）',
  configSchema: [
    {
      key: 'url',
      label: 'URL',
      type: 'url',
      required: true,
      placeholder: 'https://example.com/feed',
      description: '取得するURL',
    },
  ],

  async execute(config): Promise<ToolResult> {
    const url = config['url'];
    if (!url) {
      return { success: false, content: '', error: 'URLが設定されていません' };
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': 'Hermes-Workflow-Agent/1.0' },
        redirect: 'follow',
      });
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `フェッチ失敗: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        content: '',
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const rawText = await response.text();

    const text = contentType.includes('text/html')
      ? stripHtml(rawText)
      : rawText;

    const content = text.slice(0, MAX_CONTENT_LENGTH);

    return { success: true, content };
  },
};

/**
 * HTMLからタグを除去してプレーンテキストに変換する。
 * script・style要素は中身ごと削除する。
 */
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
