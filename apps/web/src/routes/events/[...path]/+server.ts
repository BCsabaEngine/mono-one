import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createEventsRouter } from '@mono/events-client'
import { baseContextFromHeaders } from '@mono/shared-trpc'
import type { RequestHandler } from './$types'
import { bus } from '#lib/server/bus.ts'
import { getServices } from '#lib/server/services.ts'

// web is a subscriber only: events.deliver is mounted here and forwards to the connected browsers
const eventsRouter = createEventsRouter('web', {
	'order.placed': event => void bus.emit('order.placed', event.payload)
})

export const POST: RequestHandler = ({ request }) =>
	fetchRequestHandler({
		endpoint: '/events',
		req: request,
		router: eventsRouter,
		createContext: () => baseContextFromHeaders(request.headers, getServices().log)
	})
