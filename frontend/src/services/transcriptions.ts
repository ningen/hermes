/**
 * 文字起こし API クライアント
 */

const API_BASE_URL = '/api';

export interface TranscriptionSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileKey: string;
  status: 'processing' | 'completed' | 'error';
  transcript: string | null;
  segments: TranscriptionSegment[] | null;
  durationSeconds: number | null;
  language: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduleCandidate {
  title: string;
  description: string;
  startTime: string;
  endTime: string | null;
}

class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit,
  token: string
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new APIError(res.status, (data as { error?: string }).error ?? 'エラーが発生しました');
  }
  return data as T;
}

export async function uploadTranscription(
  file: File,
  title: string,
  token: string
): Promise<Transcription> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);

  const res = await fetch(`${API_BASE_URL}/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new APIError(res.status, (data as { error?: string }).error ?? 'アップロードに失敗しました');
  }
  return data as Transcription;
}

export async function listTranscriptions(token: string): Promise<Transcription[]> {
  return request<Transcription[]>('/transcriptions', { method: 'GET' }, token);
}

export async function getTranscription(id: string, token: string): Promise<Transcription> {
  return request<Transcription>(`/transcriptions/${id}`, { method: 'GET' }, token);
}

export async function deleteTranscription(id: string, token: string): Promise<void> {
  await request<{ success: boolean }>(`/transcriptions/${id}`, { method: 'DELETE' }, token);
}

export async function extractSchedules(
  id: string,
  token: string
): Promise<{ schedules: ScheduleCandidate[] }> {
  return request<{ schedules: ScheduleCandidate[] }>(
    `/transcriptions/${id}/extract-schedules`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    token
  );
}

export async function createScheduleFromTranscription(
  id: string,
  schedule: { title: string; description: string; startTime: string; endTime: string | null },
  token: string
): Promise<void> {
  await request<{ success: boolean }>(
    `/transcriptions/${id}/create-schedule`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    },
    token
  );
}
