/**
 * ワークフロー API エンドポイント
 *
 * GET    /api/workflows         - 一覧取得
 * POST   /api/workflows         - 作成
 * GET    /api/workflows/:id     - 詳細取得（ツール設定込み）
 * PUT    /api/workflows/:id     - 更新（ツール設定の全置換含む）
 * DELETE /api/workflows/:id     - 削除
 * GET    /api/tools             - 利用可能ツール一覧（認証不要）
 */
import type { Env } from '../utils/types.js';
import { requireAuth } from '../auth/middleware.js';
import {
  createWorkflow,
  getWorkflowsByUserId,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  getWorkflowTools,
  replaceWorkflowTools,
} from '../db/workflows.js';
import { listTools } from '../tools/registry.js';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// GET /api/tools
// ---------------------------------------------------------------------------

export async function handleListTools(_request: Request, _env: Env): Promise<Response> {
  return json(listTools());
}

// ---------------------------------------------------------------------------
// GET /api/workflows
// ---------------------------------------------------------------------------

export async function handleListWorkflows(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    try {
      const workflows = await getWorkflowsByUserId(env.DB, userId);
      return json(workflows);
    } catch (err) {
      console.error('[workflows/list] Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  });
}

// ---------------------------------------------------------------------------
// POST /api/workflows
// ---------------------------------------------------------------------------

export async function handleCreateWorkflow(request: Request, env: Env): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    try {
      const body = await request.json() as {
        name?: string;
        schedule?: string;
        prompt?: string;
        tools?: Array<{ toolId: string; config: Record<string, string>; orderIndex: number }>;
      };

      if (!body.name?.trim()) return json({ error: 'name is required' }, 400);
      if (!body.schedule?.trim()) return json({ error: 'schedule is required' }, 400);
      if (!body.prompt?.trim()) return json({ error: 'prompt is required' }, 400);
      if (!isValidSchedule(body.schedule)) {
        return json({ error: 'Invalid schedule format. Use "hourly", "daily:HH", or "weekly:D:HH"' }, 400);
      }

      const workflow = await createWorkflow(env.DB, {
        userId,
        name: body.name.trim(),
        schedule: body.schedule.trim(),
        prompt: body.prompt.trim(),
      });

      if (body.tools?.length) {
        await replaceWorkflowTools(env.DB, workflow.id, body.tools);
      }

      const tools = await getWorkflowTools(env.DB, workflow.id);
      return json({ ...workflow, tools }, 201);
    } catch (err) {
      console.error('[workflows/create] Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  });
}

// ---------------------------------------------------------------------------
// GET /api/workflows/:id
// ---------------------------------------------------------------------------

export async function handleGetWorkflow(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    try {
      const workflow = await getWorkflowById(env.DB, id);
      if (!workflow) return json({ error: 'Not found' }, 404);
      if (workflow.userId !== userId) return json({ error: 'Forbidden' }, 403);

      const tools = await getWorkflowTools(env.DB, id);
      return json({ ...workflow, tools });
    } catch (err) {
      console.error('[workflows/get] Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  });
}

// ---------------------------------------------------------------------------
// PUT /api/workflows/:id
// ---------------------------------------------------------------------------

export async function handleUpdateWorkflow(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    try {
      const workflow = await getWorkflowById(env.DB, id);
      if (!workflow) return json({ error: 'Not found' }, 404);
      if (workflow.userId !== userId) return json({ error: 'Forbidden' }, 403);

      const body = await request.json() as {
        name?: string;
        schedule?: string;
        prompt?: string;
        isActive?: boolean;
        tools?: Array<{ toolId: string; config: Record<string, string>; orderIndex: number }>;
      };

      if (body.schedule && !isValidSchedule(body.schedule)) {
        return json({ error: 'Invalid schedule format' }, 400);
      }

      await updateWorkflow(env.DB, id, {
        name: body.name?.trim(),
        schedule: body.schedule?.trim(),
        prompt: body.prompt?.trim(),
        isActive: body.isActive,
      });

      if (body.tools !== undefined) {
        await replaceWorkflowTools(env.DB, id, body.tools);
      }

      const updated = await getWorkflowById(env.DB, id);
      const tools = await getWorkflowTools(env.DB, id);
      return json({ ...updated, tools });
    } catch (err) {
      console.error('[workflows/update] Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/workflows/:id
// ---------------------------------------------------------------------------

export async function handleDeleteWorkflow(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  return requireAuth(request, env, async (userId) => {
    try {
      const workflow = await getWorkflowById(env.DB, id);
      if (!workflow) return json({ error: 'Not found' }, 404);
      if (workflow.userId !== userId) return json({ error: 'Forbidden' }, 403);

      await deleteWorkflow(env.DB, id);
      return json({ message: 'Deleted' });
    } catch (err) {
      console.error('[workflows/delete] Error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidSchedule(s: string): boolean {
  if (s === 'hourly') return true;
  if (/^daily:\d{1,2}$/.test(s)) {
    const h = parseInt(s.split(':')[1], 10);
    return h >= 0 && h <= 23;
  }
  if (/^weekly:\d:\d{1,2}$/.test(s)) {
    const parts = s.split(':');
    const dow = parseInt(parts[1], 10);
    const h = parseInt(parts[2], 10);
    return dow >= 1 && dow <= 7 && h >= 0 && h <= 23;
  }
  return false;
}
