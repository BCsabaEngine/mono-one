import type { Logger } from '@lib/logging'
import { createServiceServer } from '@lib/trpc'
import { appRouter } from '@api/customer'
import type { Config } from './config'
import { buildContainer } from './container'
import { eventsRouter } from './events'
import { createContext } from './trpc/context'

/** Composition root shared by main.ts and the integration tests. */
export const createApp = (config: Config, log: Logger) => {
  const container = buildContainer(config, log)

  const server = createServiceServer({
    log,
    serviceId: config.SERVICE_ID,
    trpc: { router: appRouter, createContext: createContext(container) },
    events: eventsRouter,
    ready: container.cradle.database.ping
  })

  return { container, server }
}
