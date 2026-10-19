import type { Logger } from '@lib/logging'
import { applyOverrides, createServiceServer } from '@lib/trpc'
import { appRouter } from '@api/order'
import type { Config } from './config'
import { buildContainer } from './container'
import type { Dependencies } from './container'
import { eventsRouter } from './events'
import { createContext } from './trpc/context'

/** Composition root shared by main.ts and the integration tests. */
export const createApp = (
  config: Config,
  log: Logger,
  overrides: Partial<Pick<Dependencies, 'customerClient' | 'publisher'>> = {}
) => {
  const container = buildContainer(config, log)

  applyOverrides(container, overrides)

  const server = createServiceServer({
    log,
    serviceId: config.SERVICE_ID,
    trpc: { router: appRouter, createContext: createContext(container) },
    events: eventsRouter,
    ready: container.cradle.database.ping
  })

  return { container, server }
}
