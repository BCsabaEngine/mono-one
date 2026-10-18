import { createEventsRouter } from '@events/client'

/** system-service owns no events and subscribes to none: the handler map is empty (checked by the compiler). */
export const eventsRouter = createEventsRouter('system-service', {})
