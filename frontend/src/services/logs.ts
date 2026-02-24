/**
 * ログ API サービス
 */
import { api } from './api';

export type MailLogStatus = 'processed' | 'filtered' | 'error';

export interface ActionResult {
  type: string;
  success: boolean;
  error?: string;
}

export interface MailLog {
  id: string;
  receivedAt: number;
  fromAddr: string;
  toAddr: string;
  subject: string | null;
  understanding: string | null;
  actionsTaken: ActionResult[] | null;
  status: MailLogStatus;
  errorMessage: string | null;
  userId: string | null;
}

export interface LogsResponse {
  logs: MailLog[];
  total: number;
  limit: number;
  offset: number;
}

export async function listLogs(
  token: string,
  options: { limit?: number; offset?: number; status?: MailLogStatus | '' } = {}
): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.status) params.set('status', options.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get<LogsResponse>(`/logs${qs}`, token);
}
