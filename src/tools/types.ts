/**
 * プラガブルツールシステムの型定義
 *
 * 新しいツールを追加するには:
 * 1. このインターフェースを実装したファイルを src/tools/ に作成
 * 2. src/tools/registry.ts に登録
 */
import type { Env } from '../utils/types.js';

/**
 * ツール設定フォームのフィールド定義
 * UIで動的にフォームを生成するために使用される
 */
export interface ToolConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
}

/**
 * ツール実行結果
 */
export interface ToolResult {
  success: boolean;
  /** エージェントのコンテキストに注入されるテキスト */
  content: string;
  error?: string;
}

/**
 * ワークフローツールのインターフェース
 * すべてのツールはこのインターフェースを実装する
 */
export interface WorkflowTool {
  /** ツールの一意識別子（DBに保存される） */
  id: string;
  /** UI表示用の名前 */
  name: string;
  /** ユーザー向けの説明 */
  description: string;
  /** ユーザーが入力する設定項目の定義 */
  configSchema: ToolConfigField[];
  /**
   * ツールを実行してコンテキストを返す
   * @param config ユーザーが設定した値（キーはconfigSchemaのkey）
   * @param env Workers環境変数
   */
  execute(config: Record<string, string>, env: Env): Promise<ToolResult>;
}
