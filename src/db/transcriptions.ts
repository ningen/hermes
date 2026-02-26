/**
 * 文字起こし CRUD
 */

export type TranscriptionStatus = 'processing' | 'completed' | 'error';

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
  status: TranscriptionStatus;
  transcript: string | null;
  segments: TranscriptionSegment[] | null;
  durationSeconds: number | null;
  language: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

interface TranscriptionRow {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_key: string;
  status: string;
  transcript: string | null;
  segments: string | null;
  duration_seconds: number | null;
  language: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

function rowToTranscription(row: TranscriptionRow): Transcription {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    fileName: row.file_name,
    fileKey: row.file_key,
    status: row.status as TranscriptionStatus,
    transcript: row.transcript,
    segments: row.segments ? (JSON.parse(row.segments) as TranscriptionSegment[]) : null,
    durationSeconds: row.duration_seconds,
    language: row.language,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTranscription(
  db: D1Database,
  data: {
    id: string;
    userId: string;
    title: string;
    fileName: string;
    fileKey: string;
  }
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO transcriptions
        (id, user_id, title, file_name, file_key, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)`
    )
    .bind(data.id, data.userId, data.title, data.fileName, data.fileKey, now, now)
    .run();
}

export async function updateTranscriptionCompleted(
  db: D1Database,
  id: string,
  data: {
    transcript: string;
    segments: TranscriptionSegment[];
    durationSeconds: number | null;
    language: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE transcriptions
       SET status = 'completed', transcript = ?, segments = ?,
           duration_seconds = ?, language = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      data.transcript,
      JSON.stringify(data.segments),
      data.durationSeconds,
      data.language,
      Date.now(),
      id
    )
    .run();
}

export async function updateTranscriptionError(
  db: D1Database,
  id: string,
  errorMessage: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE transcriptions
       SET status = 'error', error_message = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(errorMessage, Date.now(), id)
    .run();
}

export async function getTranscriptionsByUserId(
  db: D1Database,
  userId: string
): Promise<Transcription[]> {
  const result = await db
    .prepare(
      `SELECT * FROM transcriptions WHERE user_id = ? ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<TranscriptionRow>();
  return (result.results ?? []).map(rowToTranscription);
}

export async function getTranscriptionById(
  db: D1Database,
  id: string,
  userId: string
): Promise<Transcription | null> {
  const row = await db
    .prepare(`SELECT * FROM transcriptions WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<TranscriptionRow>();
  return row ? rowToTranscription(row) : null;
}

export async function deleteTranscription(
  db: D1Database,
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM transcriptions WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
