import { asValue } from 'awilix'
import type { Logger } from '@lib/logging'
import { baseContextFromHeaders, createServiceServer } from '@lib/trpc'
import { createEventsRouter } from '@events/client'
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

  Object.entries(overrides).forEach(([name, value]) =>
    container.register({ [name]: asValue(value) })
  )

  const server = createServiceServer({
    log,
    trpc: { router: appRouter, createContext: createContext(container) },
    // document-service owns no events and subscribes to none: the handler map is empty (checked by the compiler)
    events: {
      router: createEventsRouter('document-service', {}),
      createContext: headers =>
        baseContextFromHeaders(headers, log, config.SERVICE_ID)
    },
    ready: async () => undefined // no database: ready as soon as it listens
  })

  return { container, server }
}
