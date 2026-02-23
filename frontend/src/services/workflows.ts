/**
 * ワークフロー API サービス
 */
import { api } from './api';

export interface WorkflowToolConfig {
  id: string;
  workflowId: string;
  toolId: string;
  config: Record<string, string>;
  orderIndex: number;
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  schedule: string;
  prompt: string;
  isActive: boolean;
  lastRunAt: number | null;
  createdAt: number;
}

export interface WorkflowWithTools extends Workflow {
  tools: WorkflowToolConfig[];
}

export interface WorkflowInput {
  name: string;
  schedule: string;
  prompt: string;
  tools: Array<{ toolId: string; config: Record<string, string>; orderIndex: number }>;
}

export async function listWorkflows(token: string): Promise<Workflow[]> {
  return api.get<Workflow[]>('/workflows', token);
}

export async function getWorkflow(token: string, id: string): Promise<WorkflowWithTools> {
  return api.get<WorkflowWithTools>(`/workflows/${id}`, token);
}

export async function createWorkflow(token: string, data: WorkflowInput): Promise<WorkflowWithTools> {
  return api.post<WorkflowWithTools>('/workflows', data, token);
}

export async function updateWorkflow(
  token: string,
  id: string,
  data: Partial<WorkflowInput> & { isActive?: boolean }
): Promise<WorkflowWithTools> {
  return api.put<WorkflowWithTools>(`/workflows/${id}`, data, token);
}

export async function deleteWorkflow(token: string, id: string): Promise<void> {
  await api.delete(`/workflows/${id}`, token);
}

// ---------------------------------------------------------------------------
// Schedule display helpers
// ---------------------------------------------------------------------------

/** スケジュール文字列を人間が読みやすい形式に変換する */
export function formatSchedule(schedule: string): string {
  if (schedule === 'hourly') return '毎時';

  if (schedule.startsWith('daily:')) {
    const h = schedule.split(':')[1].padStart(2, '0');
    return `毎日 ${h}:00 UTC`;
  }

  if (schedule.startsWith('weekly:')) {
    const parts = schedule.split(':');
    const dow = parseInt(parts[1], 10);
    const h = parts[2].padStart(2, '0');
    const days = ['', '月', '火', '水', '木', '金', '土', '日'];
    return `毎週${days[dow] ?? '?'}曜 ${h}:00 UTC`;
  }

  return schedule;
}
