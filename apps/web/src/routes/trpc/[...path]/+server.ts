import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { RequestHandler } from './$types'
import { createWebContext } from '#lib/server/trpc/context.ts'
import { webRouter } from '#lib/server/trpc/router.ts'

const handler: RequestHandler = ({ request, locals, cookies }) =>
	fetchRequestHandler({
		endpoint: '/trpc',
		req: request,
		router: webRouter,
		createContext: () => createWebContext(locals, cookies, request.headers)
	})

export { handler as GET, handler as POST }
