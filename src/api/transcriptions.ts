/**
 * 文字起こし API エンドポイント
 *
 * POST   /api/transcriptions                    - 音声/動画アップロード → 文字起こし
 * GET    /api/transcriptions                    - 一覧取得
 * GET    /api/transcriptions/:id                - 詳細取得
 * DELETE /api/transcriptions/:id                - 削除
 * POST   /api/transcriptions/:id/extract-schedules  - テキストからスケジュール抽出
 * POST   /api/transcriptions/:id/create-schedule    - Notion にスケジュール登録
 */

import type { Env } from '../utils/types.js';
import { requireAuth } from '../auth/middleware.js';
import {
  createTranscription,
  updateTranscriptionCompleted,
  updateTranscriptionError,
  getTranscriptionsByUserId,
  getTranscriptionById,
  deleteTranscription,
  type TranscriptionSegment,
} from '../db/transcriptions.js';
import { getUserSettings } from '../db/settings.js';
import { createSchedule } from '../actions/create_schedule.js';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Workers AI Whisper のレスポンス型 */
interface WhisperResult {
  text: string;
  word_count?: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

/** スケジュール候補 */
export interface ScheduleCandidate {
  title: string;
  description: string;
  startTime: string;
  endTime: string | null;
}

/** 許可する MIME タイプ */
const ALLOWED_MIME_PREFIXES = ['audio/', 'video/'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Workers AI Whisper の JSON ペイロード制限対策)

/**
 * ポーズ（無音区間）に基づいてワードをセグメントに分割する。
 * 話者分離は Workers AI では利用不可のため、ポーズによる近似的な話者交代を実装する。
 */
function segmentByPause(
  words: Array<{ word: string; start: number; end: number }>,
  pauseThreshold = 1.5
): TranscriptionSegment[] {
  if (!words.length) return [];

  const speakers = ['話者A', '話者B', '話者C', '話者D'];
  let speakerIdx = 0;

  const segments: TranscriptionSegment[] = [];
  let current: TranscriptionSegment = {
    speaker: speakers[0],
    start: words[0].start,
    end: words[0].end,
    text: words[0].word,
  };

  for (let i = 1; i < words.length; i++) {
    const pause = words[i].start - words[i - 1].end;
    if (pause >= pauseThreshold) {
      segments.push({ ...current });
      speakerIdx = (speakerIdx + 1) % speakers.length;
      current = {
        speaker: speakers[speakerIdx],
        start: words[i].start,
        end: words[i].end,
        text: words[i].word,
      };
    } else {
      current.end = words[i].end;
      current.text += ' ' + words[i].word;
    }
  }
  segments.push(current);
  return segments;
}

/** UUID v4 を生成する */
function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// POST /api/transcriptions
// ---------------------------------------------------------------------------

export async function handleUploadTranscription(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return json({ error: 'multipart/form-data が必要です' }, 400);
    }

    const fileEntry = formData.get('file');
    const title = formData.get('title');

    // FormDataEntryValue は string | File — string でなければ File
    if (!fileEntry || typeof fileEntry === 'string') {
      return json({ error: 'file フィールドが必要です' }, 400);
    }
    const file = fileEntry as File;
    if (typeof title !== 'string' || !title.trim()) {
      return json({ error: 'title フィールドが必要です' }, 400);
    }

    const mimeType = file.type || 'application/octet-stream';
    const isAllowed = ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
    if (!isAllowed) {
      return json({ error: '音声または動画ファイルのみアップロードできます' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return json({ error: 'ファイルサイズは 10MB 以下にしてください' }, 400);
    }

    const id = generateId();
    const fileKey = `transcriptions/${userId}/${id}/${file.name}`;

    // R2 に保存
    const arrayBuffer = await file.arrayBuffer();
    await env.TRANSCRIPTION_BUCKET.put(fileKey, arrayBuffer, {
      httpMetadata: { contentType: mimeType },
    });

    // DB にレコードを作成
    await createTranscription(env.DB, {
      id,
      userId,
      title: title.trim(),
      fileName: file.name,
      fileKey,
    });

    // Workers AI Whisper で文字起こし
    try {
      const audioBytes = [...new Uint8Array(arrayBuffer)];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whisperResult = (await (env.AI as any).run('@cf/openai/whisper', {
        audio: audioBytes,
      })) as WhisperResult;

      const transcript = whisperResult.text ?? '';
      const words = whisperResult.words ?? [];

      const segments =
        words.length > 0
          ? segmentByPause(words)
          : transcript
            ? [{ speaker: '話者A', start: 0, end: 0, text: transcript }]
            : [];

      // duration は最後のワードの終了時刻から推定
      const durationSeconds =
        words.length > 0 ? words[words.length - 1].end : null;

      await updateTranscriptionCompleted(env.DB, id, {
        transcript,
        segments,
        durationSeconds,
        language: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[transcriptions/upload] Whisper error:', msg);
      await updateTranscriptionError(env.DB, id, msg);
    }

    const transcription = await getTranscriptionById(env.DB, id, userId);
    return json(transcription, 201);
  });
}

// ---------------------------------------------------------------------------
// GET /api/transcriptions
// ---------------------------------------------------------------------------

export async function handleListTranscriptions(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    const transcriptions = await getTranscriptionsByUserId(env.DB, userId);
    return json(transcriptions);
  });
}

// ---------------------------------------------------------------------------
// GET /api/transcriptions/:id
// ---------------------------------------------------------------------------

export async function handleGetTranscription(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    const transcription = await getTranscriptionById(env.DB, id, userId);
    if (!transcription) return json({ error: 'Not found' }, 404);
    return json(transcription);
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/transcriptions/:id
// ---------------------------------------------------------------------------

export async function handleDeleteTranscription(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    const transcription = await getTranscriptionById(env.DB, id, userId);
    if (!transcription) return json({ error: 'Not found' }, 404);

    // R2 からファイルを削除
    await env.TRANSCRIPTION_BUCKET.delete(transcription.fileKey);

    await deleteTranscription(env.DB, id, userId);
    return json({ success: true });
  });
}

// ---------------------------------------------------------------------------
// POST /api/transcriptions/:id/extract-schedules
// ---------------------------------------------------------------------------

export async function handleExtractSchedules(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    const transcription = await getTranscriptionById(env.DB, id, userId);
    if (!transcription) return json({ error: 'Not found' }, 404);
    if (!transcription.transcript) {
      return json({ error: '文字起こしがまだ完了していません' }, 400);
    }

    const today = new Date().toISOString().split('T')[0];
    const prompt = `以下は音声文字起こしのテキストです。テキストから日時・スケジュール・予定に関する情報を抽出してください。

文字起こしテキスト:
${transcription.transcript}

今日の日付: ${today}

抽出条件:
- 具体的な日時・時刻が含まれるイベント・予定・会議・締め切りなどを抽出する
- 日時が曖昧な場合はできるだけ推定する（「来週月曜」など）
- スケジュールが見当たらない場合は空の配列を返す

以下の JSON 形式で返してください（他のテキストは不要）:
[
  {
    "title": "イベントのタイトル",
    "description": "詳細説明（なければ空文字）",
    "startTime": "ISO 8601形式 例: 2026-03-01T10:00:00",
    "endTime": "ISO 8601形式 または null"
  }
]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${env.GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[extract-schedules] Gemini error:', errText);
      return json({ error: 'スケジュール抽出に失敗しました' }, 500);
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

    let schedules: ScheduleCandidate[] = [];
    try {
      const cleaned = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1]?.trim() ?? text.trim();
      schedules = JSON.parse(cleaned) as ScheduleCandidate[];
      if (!Array.isArray(schedules)) schedules = [];
    } catch {
      schedules = [];
    }

    return json({ schedules });
  });
}

// ---------------------------------------------------------------------------
// POST /api/transcriptions/:id/create-schedule
// ---------------------------------------------------------------------------

export async function handleCreateScheduleFromTranscription(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    const transcription = await getTranscriptionById(env.DB, id, userId);
    if (!transcription) return json({ error: 'Not found' }, 404);

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string | null;
    };

    if (!body.title?.trim()) return json({ error: 'title は必須です' }, 400);
    if (!body.startTime?.trim()) return json({ error: 'startTime は必須です' }, 400);

    const settings = await getUserSettings(env.DB, userId, env.ENCRYPTION_KEY);
    if (!settings?.notionApiKey || !settings?.notionDatabaseId) {
      return json({ error: 'Notion の設定が完了していません。設定ページで API キーとデータベース ID を登録してください。' }, 400);
    }

    const result = await createSchedule(
      {
        type: 'create_schedule',
        params: {
          title: body.title.trim(),
          description: body.description ?? '',
          startTime: body.startTime.trim(),
          endTime: body.endTime ?? undefined,
        },
      },
      settings.notionApiKey,
      settings.notionDatabaseId
    );

    if (!result.success) {
      return json({ error: result.error ?? 'スケジュール作成に失敗しました' }, 500);
    }

    return json({ success: true });
  });
}
