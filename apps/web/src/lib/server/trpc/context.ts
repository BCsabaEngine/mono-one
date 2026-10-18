import { randomUUID } from 'node:crypto'
import type { Cookies } from '@sveltejs/kit'
import { decodeJwt } from '@lib/trpc'
import type { BaseContext, CallContext } from '@lib/trpc'
import { getServices } from '../services'

export interface WebContext extends BaseContext {
	services: ReturnType<typeof getServices>
	/** Request cookies; only the login procedure writes the session cookie. */
	cookies: Cookies
	sessionId?: string
}

export const createWebContext = (locals: App.Locals, cookies: Cookies): WebContext => {
	const services = getServices()
	const requestId = randomUUID()
	const identity = locals.jwt ? decodeJwt(locals.jwt) : undefined
	return {
		services,
		cookies,
		requestId,
		log: services.log.child({ requestId }),
		...(locals.sessionId && { sessionId: locals.sessionId }),
		...(locals.jwt && { jwt: locals.jwt }),
		...(identity && { identity })
	}
}

/** Identity and request id forwarded on every downstream call. */
export const callContext = (ctx: WebContext) => ({
	context: { requestId: ctx.requestId, ...(ctx.jwt && { jwt: ctx.jwt }) } satisfies CallContext
})
