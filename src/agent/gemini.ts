/**
 * Gemini API クライアント
 *
 * Google Gemini Flash を使用してメール内容を理解し、アクションを決定する。
 */
import type { GeminiResponse } from '../actions/types.js';

/**
 * Gemini API のエンドポイント
 * gemini-2.5-flash を使用
 */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * リトライの最大回数
 */
const MAX_RETRIES = 3;

/**
 * Gemini API レスポンスの型（一部）
 */
interface GeminiApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

/**
 * Gemini の responseSchema: GeminiResponse の構造を強制する。
 * responseMimeType: 'application/json' と組み合わせて使用する。
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    understanding: {
      type: 'STRING',
      description: 'メール/メッセージ内容の要約（日本語）',
    },
    actions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            enum: ['notify_slack', 'reply_email', 'create_schedule', 'reply_slack', 'ignore'],
          },
          params: {
            type: 'OBJECT',
            properties: {
              message: { type: 'STRING' },
              to: { type: 'STRING' },
              subject: { type: 'STRING' },
              body: { type: 'STRING' },
              title: { type: 'STRING' },
              description: { type: 'STRING' },
              startTime: { type: 'STRING' },
              endTime: { type: 'STRING' },
            },
          },
        },
        required: ['type', 'params'],
      },
    },
  },
  required: ['understanding', 'actions'],
} as const;

/**
 * Gemini にプロンプトを送信してレスポンスを受け取る。
 * 最大 MAX_RETRIES 回まで指数バックオフでリトライする。
 *
 * @param prompt - Gemini へ送るプロンプト
 * @param apiKey - Gemini API キー
 * @returns Gemini が決定したアクション情報
 */
export async function callGemini(
  prompt: string,
  apiKey: string
): Promise<GeminiResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // 指数バックオフ: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }

    try {
      const result = await fetchGemini(prompt, apiKey);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[gemini] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('Gemini API call failed after retries');
}

/**
 * Gemini API を実際に呼び出す。
 */
async function fetchGemini(prompt: string, apiKey: string): Promise<GeminiResponse> {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const apiResponse = await response.json() as GeminiApiResponse;

  const text = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return parseGeminiResponse(text);
}

/**
 * Gemini のレスポンステキストをパースして GeminiResponse 型に変換する。
 */
function parseGeminiResponse(text: string): GeminiResponse {
  // JSON ブロックを抽出（```json ... ``` 形式にも対応）
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, text];
  const jsonText = jsonMatch[1]?.trim() ?? text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${text}`);
  }

  if (!isGeminiResponse(parsed)) {
    throw new Error(`Unexpected Gemini response format: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

/**
 * 型ガード: オブジェクトが GeminiResponse 形式かどうかを確認する。
 */
function isGeminiResponse(value: unknown): value is GeminiResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['understanding'] !== 'string') return false;
  if (!Array.isArray(obj['actions'])) return false;
  return true;
}

/**
 * 指定ミリ秒スリープする。
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
