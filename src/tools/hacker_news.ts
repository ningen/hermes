/**
 * Hacker News ツール
 *
 * Hacker News の公開APIからトップストーリーを取得し、
 * タイトル・URL・スコア・コメント数をエージェントに渡す。
 *
 * API: https://github.com/HackerNews/API
 */
import type { WorkflowTool, ToolResult } from './types.js';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

/** デフォルトで取得するストーリー数 */
const DEFAULT_MAX_ITEMS = 10;
const MAX_ITEMS_LIMIT = 30;

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  descendants?: number; // コメント数
  by: string;
  time: number;
}

type FeedType = 'top' | 'new' | 'best' | 'ask' | 'show';

const FEED_LABELS: Record<FeedType, string> = {
  top: 'トップ',
  new: '新着',
  best: 'ベスト',
  ask: 'Ask HN',
  show: 'Show HN',
};

export const hackerNewsTool: WorkflowTool = {
  id: 'hacker_news',
  name: 'Hacker News',
  description: 'Hacker NewsのトップストーリーをHN公開APIから取得してエージェントに渡す',
  configSchema: [
    {
      key: 'feed_type',
      label: 'フィード種別',
      type: 'text',
      required: false,
      placeholder: 'top',
      description: '取得するフィード（top / new / best / ask / show）デフォルト: top',
    },
    {
      key: 'max_items',
      label: '取得件数',
      type: 'text',
      required: false,
      placeholder: String(DEFAULT_MAX_ITEMS),
      description: `取得するストーリーの件数（1〜${MAX_ITEMS_LIMIT}、デフォルト: ${DEFAULT_MAX_ITEMS}）`,
    },
    {
      key: 'min_score',
      label: '最低スコア',
      type: 'text',
      required: false,
      placeholder: '0',
      description: 'この値未満のスコアのストーリーを除外する（デフォルト: 0=フィルタなし）',
    },
  ],

  async execute(config): Promise<ToolResult> {
    const rawFeedType = (config['feed_type'] ?? 'top').trim().toLowerCase();
    const feedType: FeedType = (rawFeedType in FEED_LABELS) ? rawFeedType as FeedType : 'top';
    const maxItems = Math.min(
      Math.max(1, parseInt(config['max_items'] ?? '', 10) || DEFAULT_MAX_ITEMS),
      MAX_ITEMS_LIMIT,
    );
    const minScore = Math.max(0, parseInt(config['min_score'] ?? '', 10) || 0);

    // ストーリーIDリストを取得
    let ids: number[];
    try {
      const res = await fetch(`${HN_API_BASE}/${feedType}stories.json`, {
        headers: { 'User-Agent': 'Hermes-Workflow-Agent/1.0' },
      });
      if (!res.ok) {
        return { success: false, content: '', error: `HN API エラー: HTTP ${res.status}` };
      }
      ids = await res.json() as number[];
    } catch (err) {
      return {
        success: false,
        content: '',
        error: `HN APIへの接続失敗: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // スコアフィルタのため候補を多めに取得してから絞り込む
    const candidateIds = ids.slice(0, Math.min(maxItems * 3, 60));
    const items = await fetchItems(candidateIds);

    const filtered = items
      .filter(item => item.score >= minScore)
      .slice(0, maxItems);

    if (filtered.length === 0) {
      return {
        success: false,
        content: '',
        error: `条件に合うストーリーが見つかりませんでした（最低スコア: ${minScore}）`,
      };
    }

    const feedLabel = FEED_LABELS[feedType];
    const lines: string[] = [`【Hacker News ${feedLabel}ストーリー】`, `取得件数: ${filtered.length}件`, ''];

    for (const [i, item] of filtered.entries()) {
      const date = new Date(item.time * 1000).toISOString().slice(0, 10);
      const comments = item.descendants ?? 0;
      lines.push(`${i + 1}. ${item.title}`);
      lines.push(`   URL: ${item.url ?? `https://news.ycombinator.com/item?id=${item.id}`}`);
      lines.push(`   スコア: ${item.score}  コメント: ${comments}  投稿者: ${item.by}  日付: ${date}`);
      lines.push(`   HN: https://news.ycombinator.com/item?id=${item.id}`);
      lines.push('');
    }

    return { success: true, content: lines.join('\n').trimEnd() };
  },
};

/** 複数のHNアイテムを並列取得する */
async function fetchItems(ids: number[]): Promise<HNItem[]> {
  const promises = ids.map(id =>
    fetch(`${HN_API_BASE}/item/${id}.json`, {
      headers: { 'User-Agent': 'Hermes-Workflow-Agent/1.0' },
    })
      .then(r => r.json() as Promise<HNItem | null>)
      .catch(() => null),
  );
  const results = await Promise.all(promises);
  return results.filter((item): item is HNItem => item !== null && item.title !== undefined);
}
