import { createEventsRouter } from '@mono/events-client'

/** customer-service owns no events and subscribes to none: the handler map is empty (checked by the compiler). */
export const eventsRouter = createEventsRouter('customer-service', {})
