/**
 * ワークフローツールレジストリ
 *
 * 新しいツールを追加するには:
 * 1. src/tools/ に実装ファイルを作成（WorkflowTool インターフェースを実装）
 * 2. このファイルに import して TOOLS に追加するだけ
 */
import type { WorkflowTool } from './types.js';
import { fetchUrlTool } from './fetch_url.js';

/** 利用可能なすべてのツール */
const TOOLS: WorkflowTool[] = [
  fetchUrlTool,
  // 今後追加するツールはここに追記する
  // rssFeedTool,
  // notionQueryTool,
  // githubIssuesTool,
];

const toolMap = new Map<string, WorkflowTool>(TOOLS.map(t => [t.id, t]));

/** ツールIDからツールを取得する */
export function getTool(id: string): WorkflowTool | undefined {
  return toolMap.get(id);
}

/** 利用可能なすべてのツールをUI表示用に返す */
export function listTools(): Array<{
  id: string;
  name: string;
  description: string;
  configSchema: WorkflowTool['configSchema'];
}> {
  return TOOLS.map(({ id, name, description, configSchema }) => ({
    id,
    name,
    description,
    configSchema,
  }));
}
