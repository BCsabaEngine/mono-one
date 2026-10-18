import type { Handle } from '@sveltejs/kit/hooks'
import { loadJwt, SESSION_COOKIE } from '#lib/server/session.ts'

// End users are authenticated here only; the JWT lives in Redis and is forwarded to the core services.
export const handle: Handle = async ({ event, resolve }) => {
	const sid = event.cookies.get(SESSION_COOKIE)
	if (sid) {
		const jwt = await loadJwt(sid).catch(() => undefined)
		if (jwt) Object.assign(event.locals, { jwt, sessionId: sid })
	}
	return resolve(event)
}
