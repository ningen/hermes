/**
 * ツール一覧 API サービス
 */
import { api } from './api';

export interface ToolConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  configSchema: ToolConfigField[];
}

export async function listTools(): Promise<ToolDefinition[]> {
  return api.get<ToolDefinition[]>('/tools');
}
