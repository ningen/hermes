import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as workflowsService from '../services/workflows';
import { APIError } from '../services/api';

export default function WorkflowsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<workflowsService.Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    workflowsService.listWorkflows(token)
      .then(setWorkflows)
      .catch((err) => setError(err instanceof APIError ? err.message : 'Failed to load workflows'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggleActive = async (wf: workflowsService.Workflow) => {
    if (!token) return;
    try {
      await workflowsService.updateWorkflow(token, wf.id, { isActive: !wf.isActive });
      setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, isActive: !wf.isActive } : w));
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!window.confirm('このワークフローを削除しますか？')) return;
    try {
      await workflowsService.deleteWorkflow(token, id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="text-gray-600">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">ワークフロー</h2>
          <p className="mt-1 text-sm text-gray-500">
            定期実行するタスクをプロンプトとスケジュールで定義できます
          </p>
        </div>
        <button
          onClick={() => navigate('/workflows/new')}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          + 新規作成
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 text-sm">ワークフローがまだありません</p>
          <button
            onClick={() => navigate('/workflows/new')}
            className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            最初のワークフローを作成する
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {workflows.map((wf) => (
            <li key={wf.id} className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${wf.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <p className="text-sm font-medium text-gray-900 truncate">{wf.name}</p>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {workflowsService.formatSchedule(wf.schedule)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 truncate pl-5">{wf.prompt}</p>
                  {wf.lastRunAt && (
                    <p className="mt-0.5 text-xs text-gray-400 pl-5">
                      最終実行: {new Date(wf.lastRunAt * 1000).toLocaleString('ja-JP')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(wf)}
                    className={`text-xs px-2 py-1 rounded ${
                      wf.isActive
                        ? 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        : 'text-green-700 bg-green-100 hover:bg-green-200'
                    }`}
                  >
                    {wf.isActive ? '停止' : '有効化'}
                  </button>
                  <button
                    onClick={() => navigate(`/workflows/${wf.id}/edit`)}
                    className="text-xs px-2 py-1 rounded text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(wf.id)}
                    className="text-xs px-2 py-1 rounded text-red-600 bg-red-50 hover:bg-red-100"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
