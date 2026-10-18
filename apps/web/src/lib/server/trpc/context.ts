import { randomUUID } from 'node:crypto'
import { decodeJwt, type BaseContext, type CallContext } from '@mono/shared-trpc'
import { getServices } from '../services'

export interface WebContext extends BaseContext {
	services: ReturnType<typeof getServices>
}

export const createWebContext = (locals: App.Locals): WebContext => {
	const services = getServices()
	const requestId = randomUUID()
	const identity = locals.jwt ? decodeJwt(locals.jwt) : undefined
	return {
		services,
		requestId,
		log: services.log.child({ requestId }),
		...(locals.jwt && { jwt: locals.jwt }),
		...(identity && { identity })
	}
}

/** Identity and request id forwarded on every downstream call. */
export const callContext = (ctx: WebContext) => ({
	context: { requestId: ctx.requestId, ...(ctx.jwt && { jwt: ctx.jwt }) } satisfies CallContext
})
