import { requireAuth } from "../auth/middleware";
import { getEmailRoutesByUserId } from "../db/routes";
import { Env } from "../utils/types";

export async function handleGetEmailRoute(request: Request, env: Env): Promise<Response> {
    return requireAuth(request, env, async (userId) => {
        const emailRoute = await getEmailRoutesByUserId(env.DB, userId)
        if (!emailRoute) {
            return new Response(null, { status: 404, headers: { 'Content-Type': 'application/json' } })
        }
        
        // TODO: 本当はちゃんと mapping したほうがいい
        return new Response(JSON.stringify({
            ...emailRoute
        }), { status: 200, headers: { 'Content-Type': 'application/json' }})
    })
}