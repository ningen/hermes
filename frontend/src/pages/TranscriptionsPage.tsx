import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  listTranscriptions,
  uploadTranscription,
  deleteTranscription,
  type Transcription,
} from '../services/transcriptions';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: Transcription['status'] }) {
  const styles: Record<Transcription['status'], string> = {
    processing: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  };
  const labels: Record<Transcription['status'], string> = {
    processing: '処理中',
    completed: '完了',
    error: 'エラー',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function TranscriptionsPage() {
  const { token } = useAuth();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    listTranscriptions(token)
      .then(setTranscriptions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFileChange = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!file || !title.trim() || !token) return;
    setUploading(true);
    setUploadError(null);
    try {
      const t = await uploadTranscription(file, title.trim(), token);
      setTranscriptions((prev) => [t, ...prev]);
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!window.confirm('この文字起こしを削除しますか？')) return;
    try {
      await deleteTranscription(id, token);
      setTranscriptions((prev) => prev.filter((t) => t.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">文字起こし</h2>

      {/* Upload form */}
      <div className="mb-8 bg-gray-50 rounded-lg p-5 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">音声・動画をアップロード</h3>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${
            dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) handleFileChange(dropped);
          }}
        >
          {file ? (
            <p className="text-sm text-indigo-700 font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">ここにファイルをドロップ、またはクリックして選択</p>
              <p className="text-xs text-gray-400 mt-1">対応形式: mp3, wav, ogg, flac, m4a, mp4, webm など (最大 25MB)</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 会議録音 2026-02-26"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? '処理中...' : 'アップロード'}
          </button>
        </div>

        {uploadError && (
          <p className="mt-2 text-sm text-red-600">{uploadError}</p>
        )}

        {uploading && (
          <p className="mt-2 text-xs text-gray-500">
            ファイルをアップロードして文字起こし中です。しばらくお待ちください...
          </p>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : transcriptions.length === 0 ? (
        <p className="text-sm text-gray-500">文字起こしはまだありません。音声・動画ファイルをアップロードして始めましょう。</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {transcriptions.map((t) => (
            <li key={t.id} className="py-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={t.status} />
                  {t.status === 'completed' ? (
                    <Link
                      to={`/transcriptions/${t.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 truncate"
                    >
                      {t.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                  )}
                  {t.durationSeconds !== null && (
                    <span className="text-xs text-gray-400">{formatDuration(t.durationSeconds)}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {t.fileName} · {new Date(t.createdAt).toLocaleString('ja-JP')}
                </p>
                {t.status === 'error' && t.errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{t.errorMessage}</p>
                )}
                {t.status === 'completed' && t.transcript && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.transcript}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="ml-4 text-xs text-red-500 hover:text-red-700 flex-shrink-0"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
