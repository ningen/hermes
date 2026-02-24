/**
 * ワークフロー DB 操作
 */

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  /** "hourly" | "daily:09" | "weekly:1:09" (時刻はUTC、曜日: 1=月 〜 7=日) */
  schedule: string;
  prompt: string;
  /** 'llm': LLM がアクションを推論 / 'direct': ユーザー定義アクションをそのまま実行 */
  mode: 'llm' | 'direct';
  isActive: boolean;
  lastRunAt: number | null;
  createdAt: number;
}

/**
 * ユーザー定義アクション設定（direct モード用）
 *
 * params_template の文字列値には {{tool_id}} 形式のプレースホルダーを使用できる。
 * 実行時にそのツールの出力内容に置換される。
 */
export interface WorkflowActionConfig {
  id: string;
  workflowId: string;
  actionType: string;
  /** アクション固有パラメータ。値の文字列に {{tool_id}} テンプレートを含められる */
  paramsTemplate: Record<string, string>;
  orderIndex: number;
}

export interface WorkflowToolConfig {
  id: string;
  workflowId: string;
  toolId: string;
  /** ツール固有の設定値（JSON） */
  config: Record<string, string>;
  orderIndex: number;
}

export interface WorkflowWithTools extends Workflow {
  tools: WorkflowToolConfig[];
  actions: WorkflowActionConfig[];
}

// ---------------------------------------------------------------------------
// Workflow CRUD
// ---------------------------------------------------------------------------

export async function createWorkflow(
  db: D1Database,
  data: {
    userId: string;
    name: string;
    schedule: string;
    prompt: string;
    mode?: 'llm' | 'direct';
  }
): Promise<Workflow> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const mode = data.mode ?? 'llm';

  await db
    .prepare(
      `INSERT INTO workflows (id, user_id, name, schedule, prompt, mode, is_active, last_run_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?)`
    )
    .bind(id, data.userId, data.name, data.schedule, data.prompt, mode, now)
    .run();

  return {
    id,
    userId: data.userId,
    name: data.name,
    schedule: data.schedule,
    prompt: data.prompt,
    mode,
    isActive: true,
    lastRunAt: null,
    createdAt: now,
  };
}

export async function getWorkflowsByUserId(
  db: D1Database,
  userId: string
): Promise<Workflow[]> {
  const rows = await db
    .prepare(`SELECT * FROM workflows WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(userId)
    .all<{
      id: string;
      user_id: string;
      name: string;
      schedule: string;
      prompt: string;
      mode: string | null;
      is_active: number;
      last_run_at: number | null;
      created_at: number;
    }>();

  return (rows.results ?? []).map(rowToWorkflow);
}

export async function getWorkflowById(
  db: D1Database,
  id: string
): Promise<Workflow | null> {
  const row = await db
    .prepare(`SELECT * FROM workflows WHERE id = ?`)
    .bind(id)
    .first<{
      id: string;
      user_id: string;
      name: string;
      schedule: string;
      prompt: string;
      mode: string | null;
      is_active: number;
      last_run_at: number | null;
      created_at: number;
    }>();

  return row ? rowToWorkflow(row) : null;
}

export async function updateWorkflow(
  db: D1Database,
  id: string,
  data: {
    name?: string;
    schedule?: string;
    prompt?: string;
    mode?: 'llm' | 'direct';
    isActive?: boolean;
  }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.schedule !== undefined) { fields.push('schedule = ?'); values.push(data.schedule); }
  if (data.prompt !== undefined) { fields.push('prompt = ?'); values.push(data.prompt); }
  if (data.mode !== undefined) { fields.push('mode = ?'); values.push(data.mode); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

  if (fields.length === 0) return;

  values.push(id);
  await db
    .prepare(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function deleteWorkflow(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM workflows WHERE id = ?`).bind(id).run();
}

export async function updateWorkflowLastRun(
  db: D1Database,
  id: string,
  lastRunAt: number
): Promise<void> {
  await db
    .prepare(`UPDATE workflows SET last_run_at = ? WHERE id = ?`)
    .bind(lastRunAt, id)
    .run();
}

/** Cronハンドラ用: アクティブなワークフローを全件取得 */
export async function getAllActiveWorkflows(db: D1Database): Promise<Workflow[]> {
  const rows = await db
    .prepare(`SELECT * FROM workflows WHERE is_active = 1`)
    .all<{
      id: string;
      user_id: string;
      name: string;
      schedule: string;
      prompt: string;
      mode: string | null;
      is_active: number;
      last_run_at: number | null;
      created_at: number;
    }>();

  return (rows.results ?? []).map(rowToWorkflow);
}

// ---------------------------------------------------------------------------
// WorkflowToolConfig CRUD
// ---------------------------------------------------------------------------

export async function getWorkflowTools(
  db: D1Database,
  workflowId: string
): Promise<WorkflowToolConfig[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM workflow_tools WHERE workflow_id = ? ORDER BY order_index ASC`
    )
    .bind(workflowId)
    .all<{
      id: string;
      workflow_id: string;
      tool_id: string;
      config: string;
      order_index: number;
    }>();

  return (rows.results ?? []).map(r => ({
    id: r.id,
    workflowId: r.workflow_id,
    toolId: r.tool_id,
    config: JSON.parse(r.config) as Record<string, string>,
    orderIndex: r.order_index,
  }));
}

export async function replaceWorkflowTools(
  db: D1Database,
  workflowId: string,
  tools: Array<{ toolId: string; config: Record<string, string>; orderIndex: number }>
): Promise<void> {
  // 既存ツールを削除してから再挿入（シンプルな全置換）
  await db.prepare(`DELETE FROM workflow_tools WHERE workflow_id = ?`).bind(workflowId).run();

  for (const tool of tools) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO workflow_tools (id, workflow_id, tool_id, config, order_index)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, workflowId, tool.toolId, JSON.stringify(tool.config), tool.orderIndex)
      .run();
  }
}

// ---------------------------------------------------------------------------
// WorkflowActionConfig CRUD (direct モード用)
// ---------------------------------------------------------------------------

export async function getWorkflowActions(
  db: D1Database,
  workflowId: string
): Promise<WorkflowActionConfig[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY order_index ASC`
    )
    .bind(workflowId)
    .all<{
      id: string;
      workflow_id: string;
      action_type: string;
      params_template: string;
      order_index: number;
    }>();

  return (rows.results ?? []).map(r => ({
    id: r.id,
    workflowId: r.workflow_id,
    actionType: r.action_type,
    paramsTemplate: JSON.parse(r.params_template) as Record<string, string>,
    orderIndex: r.order_index,
  }));
}

export async function replaceWorkflowActions(
  db: D1Database,
  workflowId: string,
  actions: Array<{ actionType: string; paramsTemplate: Record<string, string>; orderIndex: number }>
): Promise<void> {
  await db.prepare(`DELETE FROM workflow_actions WHERE workflow_id = ?`).bind(workflowId).run();

  for (const action of actions) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO workflow_actions (id, workflow_id, action_type, params_template, order_index)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, workflowId, action.actionType, JSON.stringify(action.paramsTemplate), action.orderIndex)
      .run();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToWorkflow(row: {
  id: string;
  user_id: string;
  name: string;
  schedule: string;
  prompt: string;
  mode?: string | null;
  is_active: number;
  last_run_at: number | null;
  created_at: number;
}): Workflow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    schedule: row.schedule,
    prompt: row.prompt,
    mode: row.mode === 'direct' ? 'direct' : 'llm',
    isActive: row.is_active === 1,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
  };
}
