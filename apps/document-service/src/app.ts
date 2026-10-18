import type { Logger } from '@lib/logging'
import { baseContextFromHeaders, createServiceServer } from '@lib/trpc'
import { appRouter } from '@api/document'
import type { Config } from './config'
import { buildContainer } from './container'
import type { Cradle } from './container'
import { buildEventsRouter } from './events'
import { createContext } from './trpc/context'

/** Composition root shared by main.ts and the integration tests. */
export const createApp = (config: Config, log: Logger) => {
  const container = buildContainer(config, log)
  const server = createServiceServer({
    log,
    trpc: { router: appRouter, createContext: createContext(container) },
    events: {
      router: buildEventsRouter(() => container.createScope<Cradle>().cradle.documents),
      createContext: headers => baseContextFromHeaders(headers, log)
    },
    ready: container.cradle.database.ping
  })
  return { container, server }
}
