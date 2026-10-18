import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client'
import type { WebRouter } from '#lib/server/trpc/router.ts'

export const trpc = createTRPCClient<WebRouter>({
	links: [
		splitLink({
			condition: op => op.type === 'subscription',
			true: httpSubscriptionLink({ url: '/trpc' }),
			false: httpBatchLink({ url: '/trpc' })
		})
	]
})
