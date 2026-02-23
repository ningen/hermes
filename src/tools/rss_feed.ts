/**
 * RSSフィードツール
 *
 * 指定したRSS/AtomフィードのURLから最新記事を取得し、
 * タイトル・リンク・概要をエージェントに渡す。
 */
import type { WorkflowTool, ToolResult } from './types.js';

/** 1フィードあたり取得する最大記事数 */
const DEFAULT_MAX_ITEMS = 5;
const MAX_ITEMS_LIMIT = 20;

/** 概要テキストの最大文字数 */
const MAX_DESCRIPTION_LENGTH = 300;

export const rssFeedTool: WorkflowTool = {
  id: 'rss_feed',
  name: 'RSSフィード',
  description: 'RSS/AtomフィードのURLから最新記事の一覧を取得してエージェントに渡す',
  configSchema: [
    {
      key: 'url',
      label: 'フィードURL',
      type: 'url',
      required: true,
      placeholder: 'https://example.com/feed.xml',
      description: 'RSS 2.0 または Atom フィードのURL',
    },
    {
      key: 'max_items',
      label: '取得件数',
      type: 'text',
      required: false,
      placeholder: String(DEFAULT_MAX_ITEMS),
      description: `取得する最新記事の件数（1〜${MAX_ITEMS_LIMIT}、デフォルト: ${DEFAULT_MAX_ITEMS}）`,
    },
  ],

  async execute(config): Promise<ToolResult> {
    const url = config['url'];
    if (!url) {
      return { success: false, content: '', error: 'フィードURLが設定されていません' };
    }

    const maxItems = Math.min(
      Math.max(1, parseInt(config['max_items'] ?? '', 10) || DEFAULT_MAX_ITEMS),
      MAX_ITEMS_LIMIT,
    );

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

    const xml = await response.text();
    const isAtom = /<feed[\s>]/i.test(xml);
    const items = isAtom ? parseAtom(xml, maxItems) : parseRss(xml, maxItems);

    if (items.length === 0) {
      return {
        success: false,
        content: '',
        error: 'フィードから記事を取得できませんでした（フォーマットが非対応の可能性があります）',
      };
    }

    const lines: string[] = [`【RSSフィード: ${url}】`, `取得件数: ${items.length}件`, ''];
    for (const [i, item] of items.entries()) {
      lines.push(`${i + 1}. ${item.title}`);
      if (item.link) lines.push(`   URL: ${item.link}`);
      if (item.pubDate) lines.push(`   日時: ${item.pubDate}`);
      if (item.description) lines.push(`   概要: ${item.description}`);
      lines.push('');
    }

    return { success: true, content: lines.join('\n').trimEnd() };
  },
};

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

/** RSS 2.0 の <item> 要素をパースする */
function parseRss(xml: string, max: number): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < max) {
    const block = match[1];
    items.push({
      title: extractCdata(block, 'title'),
      link: extractCdata(block, 'link'),
      description: truncate(stripHtml(extractCdata(block, 'description')), MAX_DESCRIPTION_LENGTH),
      pubDate: extractCdata(block, 'pubDate'),
    });
  }
  return items;
}

/** Atom の <entry> 要素をパースする */
function parseAtom(xml: string, max: number): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null && items.length < max) {
    const block = match[1];
    // <link href="..."> または <link>...</link>
    const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    const linkText = hrefMatch ? hrefMatch[1] : extractCdata(block, 'link');
    items.push({
      title: extractCdata(block, 'title'),
      link: linkText,
      description: truncate(stripHtml(extractCdata(block, 'summary') || extractCdata(block, 'content')), MAX_DESCRIPTION_LENGTH),
      pubDate: extractCdata(block, 'published') || extractCdata(block, 'updated'),
    });
  }
  return items;
}

/** XML要素の内容を取得する（CDATAセクションも考慮） */
function extractCdata(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`, 'i');
  const m = block.match(regex);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').trim();
}

/** HTMLタグを除去してプレーンテキストに変換する */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}
