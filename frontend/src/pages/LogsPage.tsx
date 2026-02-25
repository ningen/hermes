import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listLogs, type MailLog, type MailLogStatus } from '../services/logs';

const STATUS_LABELS: Record<MailLogStatus, string> = {
  processed: '処理済み',
  filtered: 'フィルタ済み',
  error: 'エラー',
};

const STATUS_COLORS: Record<MailLogStatus, string> = {
  processed: 'bg-green-100 text-green-800',
  filtered: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-800',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  notify_slack: 'Slack通知',
  reply_email: 'メール返信',
  create_schedule: 'スケジュール登録',
  ignore: '無視',
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LogCard({ log }: { log: MailLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* ヘッダー行 */}
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className={`mt-0.5 shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[log.status]}`}
        >
          {STATUS_LABELS[log.status]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {log.subject || '(件名なし)'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {log.fromAddr} → {log.toAddr}
          </p>
        </div>
        <span className="hidden sm:inline text-xs text-gray-400 shrink-0">{formatDate(log.receivedAt)}</span>
        <span className="text-gray-400 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 展開コンテンツ */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {/* メタ情報 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-3 text-xs text-gray-600">
            <div>
              <span className="font-medium text-gray-700">From: </span>
              {log.fromAddr}
            </div>
            <div>
              <span className="font-medium text-gray-700">To: </span>
              {log.toAddr}
            </div>
            <div>
              <span className="font-medium text-gray-700">受信: </span>
              {formatDate(log.receivedAt)}
            </div>
            <div>
              <span className="font-medium text-gray-700">ID: </span>
              <span className="font-mono">{log.id}</span>
            </div>
          </div>

          {/* AIの理解 */}
          {log.understanding && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">AIの分析</p>
              <p className="text-sm text-gray-800 bg-white border border-gray-200 rounded p-3 whitespace-pre-wrap">
                {log.understanding}
              </p>
            </div>
          )}

          {/* 実行アクション */}
          {log.actionsTaken && log.actionsTaken.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">実行されたアクション</p>
              <div className="space-y-1">
                {log.actionsTaken.map((action, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                      action.success
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    <span>{action.success ? '✓' : '✗'}</span>
                    <span className="font-medium">
                      {ACTION_TYPE_LABELS[action.type] ?? action.type}
                    </span>
                    {action.error && <span className="text-red-600">— {action.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* エラーメッセージ */}
          {log.errorMessage && (
            <div>
              <p className="text-xs font-medium text-red-700 mb-1">エラー詳細</p>
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 font-mono whitespace-pre-wrap">
                {log.errorMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function LogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<MailLogStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listLogs(token, {
        limit: PAGE_SIZE,
        offset,
        status: statusFilter || undefined,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token, offset, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // フィルタが変わったらページをリセット
  const handleStatusChange = (v: MailLogStatus | '') => {
    setStatusFilter(v);
    setOffset(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">メール受信ログ</h1>
        <button
          onClick={fetchLogs}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          更新
        </button>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">ステータス:</span>
        {(['', 'processed', 'filtered', 'error'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'すべて' : STATUS_LABELS[s]}
          </button>
        ))}
        {total > 0 && (
          <span className="ml-auto text-xs text-gray-400">{total} 件</span>
        )}
      </div>

      {/* コンテンツ */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">ログがありません</p>
          <p className="text-sm">メールを受信すると、ここに処理結果が表示されます。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            前へ
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
