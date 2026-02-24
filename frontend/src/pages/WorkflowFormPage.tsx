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
// Direct mode action schemas
// ---------------------------------------------------------------------------

interface ActionField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
}

interface ActionSchema {
  id: string;
  name: string;
  description: string;
  fields: ActionField[];
}

const DIRECT_ACTION_SCHEMAS: ActionSchema[] = [
  {
    id: 'notify_slack',
    name: 'Slack 通知',
    description: 'Slack チャンネルにメッセージを送信します',
    fields: [
      {
        key: 'message',
        label: 'メッセージ',
        type: 'textarea',
        required: true,
        placeholder: '例: 最新ニュース:\n{{hacker_news}}',
        description: '{{tool_id}} の形式でツールの出力を埋め込めます',
      },
    ],
  },
  {
    id: 'reply_email',
    name: 'メール送信',
    description: 'Mailgun を使ってメールを送信します',
    fields: [
      {
        key: 'to',
        label: '宛先メールアドレス',
        type: 'text',
        required: true,
        placeholder: 'example@example.com',
      },
      {
        key: 'subject',
        label: '件名',
        type: 'text',
        required: true,
        placeholder: '例: 週次レポート',
      },
      {
        key: 'body',
        label: '本文',
        type: 'textarea',
        required: true,
        placeholder: '例: 今週のまとめ:\n{{rss_feed}}',
        description: '{{tool_id}} の形式でツールの出力を埋め込めます',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolEntry {
  localId: string;
  toolId: string;
  config: Record<string, string>;
}

interface ActionEntry {
  localId: string;
  actionType: string;
  paramsTemplate: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Step component
// ---------------------------------------------------------------------------

interface StepProps {
  number: number;
  title: string;
  description?: string;
  isLast?: boolean;
  children: React.ReactNode;
}

function Step({ number, title, description, isLast = false, children }: StepProps) {
  return (
    <div className="flex gap-4">
      {/* Step indicator column */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold">
          {number}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-2 mb-0" />}
      </div>

      {/* Content column */}
      <div className={`flex-1 ${isLast ? 'pb-2' : 'pb-8'}`}>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
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
  const [mode, setMode] = useState<'llm' | 'direct'>('llm');
  const [prompt, setPrompt] = useState('');
  const [toolEntries, setToolEntries] = useState<ToolEntry[]>([]);
  const [actionEntries, setActionEntries] = useState<ActionEntry[]>([]);
  const [availableTools, setAvailableTools] = useState<toolsService.ToolDefinition[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    toolsService.listTools()
      .then(setAvailableTools)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !token || !id) return;

    workflowsService.getWorkflow(token, id)
      .then((wf) => {
        setName(wf.name);
        setSchedule(wf.schedule);
        setMode(wf.mode ?? 'llm');
        setPrompt(wf.prompt);
        setToolEntries(
          wf.tools.map(t => ({
            localId: t.id,
            toolId: t.toolId,
            config: t.config,
          }))
        );
        setActionEntries(
          (wf.actions ?? []).map(a => ({
            localId: a.id,
            actionType: a.actionType,
            paramsTemplate: a.paramsTemplate,
          }))
        );
      })
      .catch((err) => setError(err instanceof APIError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [isEdit, token, id]);

  // ---- Tool handlers ----

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

  // ---- Action handlers ----

  const handleAddAction = (actionType: string) => {
    setActionEntries(prev => [
      ...prev,
      { localId: crypto.randomUUID(), actionType, paramsTemplate: {} },
    ]);
  };

  const handleRemoveAction = (localId: string) => {
    setActionEntries(prev => prev.filter(a => a.localId !== localId));
  };

  const handleActionParamChange = (localId: string, key: string, value: string) => {
    setActionEntries(prev =>
      prev.map(a =>
        a.localId === localId
          ? { ...a, paramsTemplate: { ...a.paramsTemplate, [key]: value } }
          : a
      )
    );
  };

  // ---- Submit ----

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError('');
    setSaving(true);

    const data: workflowsService.WorkflowInput = {
      name: name.trim(),
      schedule,
      mode,
      prompt: mode === 'llm' ? prompt.trim() : '',
      tools: toolEntries.map((t, i) => ({
        toolId: t.toolId,
        config: t.config,
        orderIndex: i,
      })),
      actions: mode === 'direct'
        ? actionEntries.map((a, i) => ({
            actionType: a.actionType,
            paramsTemplate: a.paramsTemplate,
            orderIndex: i,
          }))
        : [],
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
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEdit ? 'ワークフロー編集' : '新規ワークフロー作成'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          ステップに沿って設定してください。
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Step 1: 基本設定 ─────────────────────────────────────── */}
        <Step
          number={1}
          title="基本設定"
          description="ワークフローの名前と実行タイミングを決めます"
        >
          <div className="space-y-4">
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
                placeholder="例: 朝のニュースチェック"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

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
              <p className="mt-1 text-xs text-gray-500">
                時刻はすべてUTC基準です（JSTは+9時間）
              </p>
            </div>
          </div>
        </Step>

        {/* ── Step 2: データ取得ツール ──────────────────────────────── */}
        <Step
          number={2}
          title="データ取得（オプション）"
          description="実行時に外部からデータを取得します。取得したデータはステップ 3 で使用できます。"
        >
          <div className="space-y-3">
            {/* Configured tools */}
            {toolEntries.map((entry, idx) => {
              const toolDef = availableTools.find(t => t.id === entry.toolId);
              if (!toolDef) return null;
              return (
                <div key={entry.localId} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{toolDef.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{toolDef.description}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTool(entry.localId)}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 flex-shrink-0"
                    >
                      削除
                    </button>
                  </div>

                  {toolDef.configSchema.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {toolDef.configSchema.map(field => (
                        <div key={field.key}>
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
                  )}

                  {/* Template variable tag */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">変数:</span>
                    <code className="text-xs bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 text-indigo-600 font-mono">
                      {`{{${entry.toolId}}}`}
                    </code>
                  </div>
                </div>
              );
            })}

            {/* Add tool buttons */}
            {availableTools.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {toolEntries.length === 0 ? 'ツールを追加する:' : 'さらに追加:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableTools.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleAddTool(t.id)}
                      title={t.description}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 transition-colors"
                    >
                      <span className="text-base leading-none">+</span>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Step>

        {/* ── Step 3: 処理と出力 ───────────────────────────────────── */}
        <Step
          number={3}
          title="処理と出力"
          description="取得したデータをどう処理して何をするかを設定します"
          isLast
        >
          <div className="space-y-5">
            {/* Mode selection cards */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                処理方法 <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('llm')}
                  className={`text-left p-4 border-2 rounded-lg transition-all ${
                    mode === 'llm'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        mode === 'llm'
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-gray-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-gray-900">AI に判断させる</span>
                  </div>
                  <p className="text-xs text-gray-500 pl-5">
                    プロンプトを書いて AI がアクションを決定する
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('direct')}
                  className={`text-left p-4 border-2 rounded-lg transition-all ${
                    mode === 'direct'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        mode === 'direct'
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-gray-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-gray-900">直接実行</span>
                  </div>
                  <p className="text-xs text-gray-500 pl-5">
                    アクションを自分で指定する（AI 不使用）
                  </p>
                </button>
              </div>
            </div>

            {/* LLM mode: prompt */}
            {mode === 'llm' && (
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                  AI への指示（プロンプト） <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="prompt"
                  required={mode === 'llm'}
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例: 取得したニュースの中から重要なものをSlackに通知してください。技術系のトピックを優先してください。"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {toolEntries.length > 0 ? (
                  <p className="mt-1.5 text-xs text-gray-500">
                    ツールのデータ（{toolEntries.map(e => `{{${e.toolId}}}`).join('、')}）は AI が自動的に参照します
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-500">
                    ステップ 2 でツールを追加すると、そのデータを AI が参照できます
                  </p>
                )}
              </div>
            )}

            {/* Direct mode: actions */}
            {mode === 'direct' && (
              <div className="space-y-3">
                {/* Template variable hints */}
                {toolEntries.length > 0 && (
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                    <p className="text-xs font-medium text-indigo-700 mb-1.5">
                      使えるテンプレート変数（ツールの出力が埋め込まれます）:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {toolEntries.map(e => (
                        <code
                          key={e.localId}
                          className="text-xs bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-indigo-600 font-mono cursor-pointer select-all"
                          title="クリックして選択"
                        >
                          {`{{${e.toolId}}}`}
                        </code>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-500 mt-1.5">
                      メッセージ本文などにコピーして使ってください
                    </p>
                  </div>
                )}

                {/* Configured actions */}
                {actionEntries.map((entry, idx) => {
                  const schema = DIRECT_ACTION_SCHEMAS.find(s => s.id === entry.actionType);
                  if (!schema) return null;
                  return (
                    <div key={entry.localId} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{schema.name}</span>
                            <span className="ml-2 text-xs text-gray-400">{schema.description}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAction(entry.localId)}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 flex-shrink-0"
                        >
                          削除
                        </button>
                      </div>

                      <div className="space-y-2">
                        {schema.fields.map(field => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-600">
                              {field.label}
                              {field.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                rows={3}
                                required={field.required}
                                value={entry.paramsTemplate[field.key] ?? ''}
                                onChange={(e) => handleActionParamChange(entry.localId, field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm font-mono focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            ) : (
                              <input
                                type="text"
                                required={field.required}
                                value={entry.paramsTemplate[field.key] ?? ''}
                                onChange={(e) => handleActionParamChange(entry.localId, field.key, e.target.value)}
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
                    </div>
                  );
                })}

                {/* Add action buttons */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    {actionEntries.length === 0 ? '実行するアクションを追加:' : 'さらにアクションを追加:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DIRECT_ACTION_SCHEMAS.map(schema => (
                      <button
                        key={schema.id}
                        type="button"
                        onClick={() => handleAddAction(schema.id)}
                        title={schema.description}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors"
                      >
                        <span className="text-base leading-none">+</span>
                        {schema.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Step>

        {/* ── Submit ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2 pl-12">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : isEdit ? '保存する' : '作成する'}
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
