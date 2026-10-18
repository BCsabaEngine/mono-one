import { error, json } from '@sveltejs/kit'
import { unsignedJwt } from '@lib/trpc'
import type { RequestHandler } from './$types'
import { getConfig } from '#lib/server/config.ts'
import { deleteJwt, saveJwt, SESSION_COOKIE } from '#lib/server/session.ts'

// Demo login so the skeleton can be exercised end to end. Replace with the real login flow; ENABLE_DEV_LOGIN must stay off in production.
export const POST: RequestHandler = async ({ cookies, locals }) => {
	const config = getConfig()
	if (!config.ENABLE_DEV_LOGIN) error(404)
	if (locals.sessionId) await deleteJwt(locals.sessionId)
	const sid = await saveJwt(unsignedJwt({ sub: 'demo-user', roles: ['customer'] }))
	cookies.set(SESSION_COOKIE, sid, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: config.JWT_TTL_SECONDS })
	return json({ ok: true })
}
