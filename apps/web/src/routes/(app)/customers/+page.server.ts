import { walkCustomerWindows } from '#lib/customers.ts'
import { createWebContext } from '#lib/server/trpc/context.ts'
import { webRouter } from '#lib/server/trpc/router.ts'
import type { PageServerLoad } from './$types'

// the first list arrives with the page; if the services are down the page loads (and reports the error) in the browser as before
export const load: PageServerLoad = async ({ locals, cookies, request }) => {
	const caller = webRouter.createCaller(createWebContext(locals, cookies, request.headers))

	return { customers: await walkCustomerWindows(page => caller.customers.page({ page })).catch(() => undefined) }
}
