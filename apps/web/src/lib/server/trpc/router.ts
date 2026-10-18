import { on } from 'node:events'
import { createTRPC, fromClientError, requireIdentity, unsignedJwt } from '@lib/trpc'
import { getCustomerInput } from '@api/customer'
import { getDocumentInput } from '@api/document'
import { placeOrderInput } from '@api/order'
import { addUserInput, authUserInput, deleteUserInput, getUserInput, getUsersInput, updateUserInput } from '@api/system'
import { bus } from '../bus'
import { deleteJwt, saveJwt, SESSION_COOKIE } from '../session'
import { callContext } from './context'
import type { WebContext } from './context'

const { router, procedure } = createTRPC<WebContext>()

const authed = procedure.use(({ ctx, next }) => (requireIdentity(ctx), next()))

/** Browser-facing router hosted inside SvelteKit; the browser never talks to the core services. */
export const webRouter = router({
	// the real login: system-service checks the credentials, the BFF turns the user into a session JWT (stored in Redis only)
	auth: router({
		login: procedure.input(authUserInput).mutation(async ({ input, ctx }) => {
			const { config, system } = ctx.services
			const user = await system.users.auth.mutate(input).catch(fromClientError)

			if (ctx.sessionId) await deleteJwt(ctx.sessionId)

			const sid = await saveJwt(
				unsignedJwt({ sub: String(user.id), permissions: user.permissions, email: user.email, name: user.name })
			)

			ctx.cookies.set(SESSION_COOKIE, sid, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: config.JWT_TTL_SECONDS
			})

			return { id: user.id, name: user.name, permissions: user.permissions }
		})
	}),

	customers: router({
		get: authed
			.input(getCustomerInput)
			.query(({ input, ctx }) =>
				ctx.services.customer.customers.get.query(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	orders: router({
		place: authed
			.input(placeOrderInput)
			.mutation(({ input, ctx }) =>
				ctx.services.order.orders.place.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	documents: router({
		get: authed
			.input(getDocumentInput)
			.query(({ input, ctx }) =>
				ctx.services.document.documents.get.query(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	// user management lives in system-service, which enforces the permissions from the forwarded JWT
	users: router({
		get: authed
			.input(getUserInput)
			.query(({ input, ctx }) => ctx.services.system.users.get.query(input, callContext(ctx)).catch(fromClientError)),

		getMany: authed
			.input(getUsersInput)
			.query(({ input, ctx }) =>
				ctx.services.system.users.getMany.query(input, callContext(ctx)).catch(fromClientError)
			),

		add: authed
			.input(addUserInput)
			.mutation(({ input, ctx }) =>
				ctx.services.system.users.add.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		update: authed
			.input(updateUserInput)
			.mutation(({ input, ctx }) =>
				ctx.services.system.users.update.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		delete: authed
			.input(deleteUserInput)
			.mutation(({ input, ctx }) =>
				ctx.services.system.users.delete.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	// fed by order.placed events that order-service delivers to this app's /events endpoint (SSE subscription)
	live: router({
		orderPlaced: authed.subscription(async function* ({ signal }) {
			for await (const [payload] of on(bus, 'order.placed', { signal })) yield payload
		})
	})
})

export type WebRouter = typeof webRouter
