import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as workflowsService from '../services/workflows';
import * as toolsService from '../services/tools';
import { APIError } from '../services/api';

// ---------------------------------------------------------------------------
// Schedule options
// ---------------------------------------------------------------------------

const SCHEDULE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'hourly', label: '毎時' },
  ...Array.from({ length: 24 }, (_, h) => ({
    value: `daily:${h}`,
    label: `毎日 ${String(h).padStart(2, '0')}:00 UTC`,
  })),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap(dow => {
    const dayNames = ['', '月', '火', '水', '木', '金', '土', '日'];
    return Array.from({ length: 24 }, (_, h) => ({
      value: `weekly:${dow}:${h}`,
      label: `毎週${dayNames[dow]}曜 ${String(h).padStart(2, '0')}:00 UTC`,
    }));
  }),
];

// ---------------------------------------------------------------------------
// ToolConfigEntry: 追加されたツールの状態
// ---------------------------------------------------------------------------

interface ToolEntry {
  /** ローカルのみの一時ID（新規追加時） */
  localId: string;
  toolId: string;
  config: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('daily:9');
  const [prompt, setPrompt] = useState('');
  const [toolEntries, setToolEntries] = useState<ToolEntry[]>([]);
  const [availableTools, setAvailableTools] = useState<toolsService.ToolDefinition[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ツール一覧を取得
  useEffect(() => {
    toolsService.listTools()
      .then(setAvailableTools)
      .catch(() => {}); // ツール取得失敗は致命的ではない
  }, []);

  // 編集時は既存ワークフローを取得
  useEffect(() => {
    if (!isEdit || !token || !id) return;

    workflowsService.getWorkflow(token, id)
      .then((wf) => {
        setName(wf.name);
        setSchedule(wf.schedule);
        setPrompt(wf.prompt);
        setToolEntries(
          wf.tools.map(t => ({
            localId: t.id,
            toolId: t.toolId,
            config: t.config,
          }))
        );
      })
      .catch((err) => setError(err instanceof APIError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [isEdit, token, id]);

  const handleAddTool = (toolId: string) => {
    setToolEntries(prev => [
      ...prev,
      { localId: crypto.randomUUID(), toolId, config: {} },
    ]);
  };

  const handleRemoveTool = (localId: string) => {
    setToolEntries(prev => prev.filter(t => t.localId !== localId));
  };

  const handleToolConfigChange = (localId: string, key: string, value: string) => {
    setToolEntries(prev =>
      prev.map(t =>
        t.localId === localId ? { ...t, config: { ...t.config, [key]: value } } : t
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError('');
    setSaving(true);

    const data: workflowsService.WorkflowInput = {
      name: name.trim(),
      schedule,
      prompt: prompt.trim(),
      tools: toolEntries.map((t, i) => ({
        toolId: t.toolId,
        config: t.config,
        orderIndex: i,
      })),
    };

    try {
      if (isEdit && id) {
        await workflowsService.updateWorkflow(token, id, data);
      } else {
        await workflowsService.createWorkflow(token, data);
      }
      navigate('/workflows');
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="text-gray-600">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">
          {isEdit ? 'ワークフロー編集' : '新規ワークフロー作成'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          定期実行するタスクを定義します。URLからデータを取得してAIに処理させることもできます。
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            ワークフロー名 <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 朝の天気チェック"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {/* Schedule */}
        <div>
          <label htmlFor="schedule" className="block text-sm font-medium text-gray-700">
            実行スケジュール <span className="text-red-500">*</span>
          </label>
          <select
            id="schedule"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
          >
            {SCHEDULE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">時刻はすべてUTC基準です（JSTは+9時間）</p>
        </div>

        {/* Prompt */}
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
            指示（プロンプト） <span className="text-red-500">*</span>
          </label>
          <textarea
            id="prompt"
            required
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={"例: 以下のサイトの更新情報を確認し、重要なニュースがあればSlackに通知してください。"}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            AIへの指示を自由に記述してください。下のツールで取得したデータも参照できます。
          </p>
        </div>

        {/* Tools */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-gray-700">データ取得ツール</h3>
              <p className="text-xs text-gray-500">実行前に外部からデータを取得してAIに渡せます（オプション）</p>
            </div>
          </div>

          {/* 追加済みツール */}
          <div className="space-y-3">
            {toolEntries.map((entry, idx) => {
              const toolDef = availableTools.find(t => t.id === entry.toolId);
              if (!toolDef) return null;
              return (
                <div key={entry.localId} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-800">
                      #{idx + 1} {toolDef.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTool(entry.localId)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                  {toolDef.configSchema.map(field => (
                    <div key={field.key} className="mb-2">
                      <label className="block text-xs font-medium text-gray-600">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          required={field.required}
                          value={entry.config[field.key] ?? ''}
                          onChange={(e) => handleToolConfigChange(entry.localId, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <input
                          type={field.type === 'url' ? 'url' : 'text'}
                          required={field.required}
                          value={entry.config[field.key] ?? ''}
                          onChange={(e) => handleToolConfigChange(entry.localId, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      )}
                      {field.description && (
                        <p className="mt-0.5 text-xs text-gray-400">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* ツール追加セレクター */}
          {availableTools.length > 0 && (
            <div className="mt-3">
              <select
                value=""
                onChange={(e) => { if (e.target.value) handleAddTool(e.target.value); }}
                className="block w-full border border-dashed border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm text-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">+ ツールを追加...</option>
                {availableTools.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : isEdit ? '保存' : '作成'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/workflows')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
