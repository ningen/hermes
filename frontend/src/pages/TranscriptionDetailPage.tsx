import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getTranscription,
  extractSchedules,
  createScheduleFromTranscription,
  type Transcription,
  type TranscriptionSegment,
  type ScheduleCandidate,
} from '../services/transcriptions';

const SPEAKER_COLORS: Record<string, string> = {
  '話者A': 'bg-blue-100 text-blue-800',
  '話者B': 'bg-green-100 text-green-800',
  '話者C': 'bg-purple-100 text-purple-800',
  '話者D': 'bg-orange-100 text-orange-800',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SegmentView({ segment }: { segment: TranscriptionSegment }) {
  const colorClass = SPEAKER_COLORS[segment.speaker] ?? 'bg-gray-100 text-gray-800';
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 w-24 pt-0.5">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
          {segment.speaker}
        </span>
        {segment.start > 0 && (
          <p className="text-xs text-gray-400 mt-1">{formatTime(segment.start)}</p>
        )}
      </div>
      <p className="text-sm text-gray-800 leading-relaxed flex-1">{segment.text}</p>
    </div>
  );
}

function ScheduleForm({
  candidate,
  transcriptionId,
  token,
  onSuccess,
}: {
  candidate: ScheduleCandidate;
  transcriptionId: string;
  token: string;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(candidate.title);
  const [description, setDescription] = useState(candidate.description);
  const [startTime, setStartTime] = useState(candidate.startTime.replace('T', 'T').slice(0, 16));
  const [endTime, setEndTime] = useState(candidate.endTime?.slice(0, 16) ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createScheduleFromTranscription(
        transcriptionId,
        {
          title,
          description,
          startTime: new Date(startTime).toISOString(),
          endTime: endTime ? new Date(endTime).toISOString() : null,
        },
        token
      );
      setDone(true);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p className="text-xs text-green-600 font-medium mt-2">Notion に登録しました</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="説明（任意）"
        rows={2}
        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-0.5">開始</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-0.5">終了（任意）</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? '登録中...' : 'Notion に登録'}
      </button>
    </form>
  );
}

export default function TranscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleCandidate[] | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<'segments' | 'plain'>('segments');

  useEffect(() => {
    if (!id || !token) return;
    setLoading(true);
    getTranscription(id, token)
      .then(setTranscription)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  const handleExtract = async () => {
    if (!id || !token) return;
    setExtracting(true);
    setExtractError(null);
    setSchedules(null);
    try {
      const result = await extractSchedules(id, token);
      setSchedules(result.schedules);
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : 'スケジュール抽出に失敗しました');
    } finally {
      setExtracting(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!transcription) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/transcriptions" className="text-sm text-indigo-600 hover:underline">
            ← 文字起こし一覧
          </Link>
          <h2 className="text-xl font-semibold text-gray-900 mt-1">{transcription.title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {transcription.fileName} · {new Date(transcription.createdAt).toLocaleString('ja-JP')}
            {transcription.durationSeconds !== null && (
              <> · {Math.floor(transcription.durationSeconds / 60)}分{Math.floor(transcription.durationSeconds % 60)}秒</>
            )}
          </p>
        </div>
        {transcription.status === 'completed' && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="ml-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
          >
            {extracting ? '抽出中...' : 'スケジュールを抽出'}
          </button>
        )}
      </div>

      {transcription.status === 'processing' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <p className="text-sm text-yellow-800">文字起こし処理中です...</p>
        </div>
      )}

      {transcription.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-800">エラー: {transcription.errorMessage}</p>
        </div>
      )}

      {/* Extracted schedules */}
      {schedules !== null && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-indigo-900 mb-3">
            抽出されたスケジュール（{schedules.length} 件）
          </h3>
          {schedules.length === 0 ? (
            <p className="text-sm text-indigo-700">スケジュールは見つかりませんでした。</p>
          ) : (
            <ul className="space-y-3">
              {schedules.map((s, i) => (
                <li key={i} className="bg-white rounded border border-indigo-100 p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{s.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.startTime}
                        {s.endTime && ` → ${s.endTime}`}
                      </p>
                      {s.description && (
                        <p className="text-xs text-gray-600 mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedSchedule(expandedSchedule === i ? null : i)}
                      className="ml-3 text-xs text-indigo-600 hover:underline flex-shrink-0"
                    >
                      {expandedSchedule === i ? '閉じる' : 'Notionに登録'}
                    </button>
                  </div>
                  {expandedSchedule === i && id && token && (
                    <ScheduleForm
                      candidate={s}
                      transcriptionId={id}
                      token={token}
                      onSuccess={() => setExpandedSchedule(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {extractError && (
        <p className="mb-4 text-sm text-red-600">{extractError}</p>
      )}

      {/* Transcript */}
      {transcription.status === 'completed' && transcription.transcript && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">文字起こし結果</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('segments')}
                className={`px-3 py-1 text-xs rounded ${viewMode === 'segments' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                話者別
              </button>
              <button
                onClick={() => setViewMode('plain')}
                className={`px-3 py-1 text-xs rounded ${viewMode === 'plain' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                テキスト
              </button>
            </div>
          </div>

          {viewMode === 'segments' && transcription.segments && transcription.segments.length > 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-400 mb-3">
                ※ 話者分離は無音区間による近似です。実際の話者と異なる場合があります。
              </p>
              {transcription.segments.map((seg, i) => (
                <SegmentView key={i} segment={seg} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {transcription.transcript}
              </p>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                navigator.clipboard.writeText(transcription.transcript ?? '');
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              テキストをコピー
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
