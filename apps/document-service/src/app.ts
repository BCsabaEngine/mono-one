import type { Logger } from '@lib/logging'
import { applyOverrides, createServiceServer } from '@lib/trpc'
import { emptyEventsRouter } from '@events/client'
import { appRouter } from '@api/document'
import type { Config } from './config'
import { buildContainer } from './container'
import type { Dependencies } from './container'
import { createContext } from './trpc/context'

/** Composition root shared by main.ts and the integration tests. */
export const createApp = (
  config: Config,
  log: Logger,
  overrides: Partial<Pick<Dependencies, 'orderClient' | 'customerClient'>> = {}
) => {
  const container = buildContainer(config, log)

  applyOverrides(container, overrides)

  const server = createServiceServer({
    log,
    serviceId: config.SERVICE_ID,
    trpc: { router: appRouter, createContext: createContext(container) },
    events: emptyEventsRouter('document-service'),
    ready: async () => undefined // no database: ready as soon as it listens
  })

  return { container, server }
}
