import { on } from 'node:events'
import { createTRPC, fromClientError, requireIdentity } from '@lib/trpc'
import { getCustomerInput } from '@api/customer'
import { getDocumentInput } from '@api/document'
import { placeOrderInput } from '@api/order'
import { bus } from '../bus'
import { callContext } from './context'
import type { WebContext } from './context'

const { router, procedure } = createTRPC<WebContext>()
const authed = procedure.use(({ ctx, next }) => (requireIdentity(ctx), next()))

/** Browser-facing router hosted inside SvelteKit; the browser never talks to the core services. */
export const webRouter = router({
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
	// fed by order.placed events that order-service delivers to this app's /events endpoint (SSE subscription)
	live: router({
		orderPlaced: authed.subscription(async function* ({ signal }) {
			for await (const [payload] of on(bus, 'order.placed', { signal })) yield payload
		})
	})
})

export type WebRouter = typeof webRouter
