import type { Cookies } from '@sveltejs/kit'
import { baseContextFromHeaders, callContextOf } from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import { getServices } from '../services'

export interface WebContext extends BaseContext {
	services: ReturnType<typeof getServices>
	/** Request cookies; only the login procedure writes the session cookie. */
	cookies: Cookies
	sessionId?: string
}

// the trace id comes from the browser's x-trace-id header or is generated; the JWT comes from the Redis session
export const createWebContext = (locals: App.Locals, cookies: Cookies, headers: Headers): WebContext => {
	const services = getServices()
	return {
		...baseContextFromHeaders(headers, services.log, services.config.SERVICE_ID, locals.jwt),
		services,
		cookies,
		...(locals.sessionId && { sessionId: locals.sessionId })
	}
}

/** Identity and trace data forwarded on every downstream call. */
export const callContext = (ctx: WebContext) => ({ context: callContextOf(ctx) })
