import { on } from 'node:events'
import { z } from 'zod'
import { createTRPC, fromClientError, requireIdentity, unsignedJwt } from '@lib/trpc'
import {
	addAddressInput,
	addContactInput,
	addCustomerInput,
	deleteInput as deleteCustomerChildInput,
	getCustomerInput,
	listCustomersInput,
	updateAddressInput,
	updateContactInput,
	updateCustomerInput
} from '@api/customer'
import { generateOrderDocumentInput } from '@api/document'
import {
	addOrderDetailInput,
	createOrderInput,
	deleteInput as deleteOrderInput,
	getOrderInput,
	listOrdersInput
} from '@api/order'
import { addUserInput, authUserInput, deleteUserInput, getUserInput, getUsersInput, updateUserInput } from '@api/system'
import { bus } from '../bus'
import { deleteJwt, saveJwt, SESSION_COOKIE } from '../session'
import { callContext } from './context'
import type { WebContext } from './context'

const { router, procedure } = createTRPC<WebContext>()

const authed = procedure.use(({ ctx, next }) => (requireIdentity(ctx), next()))

// customer-service has no "list all" call: customers.list takes up to 100 ids and omits unknown ones. Identity ids are contiguous, so a full window means there may be more
const CUSTOMER_PAGE_SIZE = 100

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
		}),

		logout: procedure.mutation(async ({ ctx }) => {
			if (ctx.sessionId) await deleteJwt(ctx.sessionId)

			ctx.cookies.delete(SESSION_COOKIE, { path: '/' })
		})
	}),

	customers: router({
		get: authed
			.input(getCustomerInput)
			.query(({ input, ctx }) =>
				ctx.services.customer.customers.get.query(input, callContext(ctx)).catch(fromClientError)
			),

		// soft-deleted customers included (deletedAt set), for resolving names of existing orders
		byIds: authed
			.input(listCustomersInput)
			.query(({ input, ctx }) =>
				ctx.services.customer.customers.list.query(input, callContext(ctx)).catch(fromClientError)
			),

		// one window of CUSTOMER_PAGE_SIZE ids; active customers only
		page: authed.input(z.object({ page: z.number().int().min(0).max(1000) })).query(async ({ input, ctx }) => {
			const ids = Array.from({ length: CUSTOMER_PAGE_SIZE }, (_, i) => input.page * CUSTOMER_PAGE_SIZE + i + 1)
			const rows = await ctx.services.customer.customers.list.query({ ids }, callContext(ctx)).catch(fromClientError)

			return { customers: rows.filter(c => !c.deletedAt), hasMore: rows.length === CUSTOMER_PAGE_SIZE }
		}),

		add: authed
			.input(addCustomerInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.customers.add.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		update: authed
			.input(updateCustomerInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.customers.update.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		delete: authed
			.input(deleteCustomerChildInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.customers.delete.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	addresses: router({
		add: authed
			.input(addAddressInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.addresses.add.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		update: authed
			.input(updateAddressInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.addresses.update.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		delete: authed
			.input(deleteCustomerChildInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.addresses.delete.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	contacts: router({
		add: authed
			.input(addContactInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.contacts.add.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		update: authed
			.input(updateContactInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.contacts.update.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		delete: authed
			.input(deleteCustomerChildInput)
			.mutation(({ input, ctx }) =>
				ctx.services.customer.contacts.delete.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	orders: router({
		create: authed
			.input(createOrderInput)
			.mutation(({ input, ctx }) =>
				ctx.services.order.orders.create.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		list: authed
			.input(listOrdersInput)
			.query(({ input, ctx }) => ctx.services.order.orders.list.query(input, callContext(ctx)).catch(fromClientError)),

		get: authed
			.input(getOrderInput)
			.query(({ input, ctx }) => ctx.services.order.orders.get.query(input, callContext(ctx)).catch(fromClientError)),

		delete: authed
			.input(deleteOrderInput)
			.mutation(({ input, ctx }) =>
				ctx.services.order.orders.delete.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	orderDetails: router({
		add: authed
			.input(addOrderDetailInput)
			.mutation(({ input, ctx }) =>
				ctx.services.order.orderDetails.add.mutate(input, callContext(ctx)).catch(fromClientError)
			),

		delete: authed
			.input(deleteOrderInput)
			.mutation(({ input, ctx }) =>
				ctx.services.order.orderDetails.delete.mutate(input, callContext(ctx)).catch(fromClientError)
			)
	}),

	documents: router({
		generateOrderDocument: authed
			.input(generateOrderDocumentInput)
			.query(({ input, ctx }) =>
				ctx.services.document.documents.generateOrderDocument.query(input, callContext(ctx)).catch(fromClientError)
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
