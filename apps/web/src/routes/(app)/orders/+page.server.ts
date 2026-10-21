import { DEFAULT_PAGE_SIZE } from '@lib/constants'
import { createWebContext } from '#lib/server/trpc/context.ts'
import { webRouter } from '#lib/server/trpc/router.ts'
import type { PageServerLoad } from './$types'

// the first page and the customers it refers to arrive with the page; if the services are down the page loads (and reports the error) in the browser as before
export const load: PageServerLoad = async ({ locals, cookies, request }) => {
	const caller = webRouter.createCaller(createWebContext(locals, cookies, request.headers))

	try {
		const orders = await caller.orders.list({ limit: DEFAULT_PAGE_SIZE, offset: 0 })
		const ids = [...new Set(orders.map(o => o.customerId))]
		const customers = ids.length ? await caller.customers.byIds({ ids }) : []

		return { initial: { orders, customers, hasMore: orders.length === DEFAULT_PAGE_SIZE } }
	} catch {
		return { initial: undefined }
	}
}
