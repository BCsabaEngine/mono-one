import type { Logger } from '@lib/logging'
import { baseContextFromHeaders, createServiceServer } from '@lib/trpc'
import { appRouter } from '@api/order'
import type { Config } from './config'
import { asValue } from 'awilix'
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

  Object.entries(overrides).forEach(([name, value]) =>
    container.register({ [name]: asValue(value) })
  )

  const server = createServiceServer({
    log,
    trpc: { router: appRouter, createContext: createContext(container) },
    events: {
      router: eventsRouter,
      createContext: headers =>
        baseContextFromHeaders(headers, log, config.SERVICE_ID)
    },
    ready: container.cradle.database.ping
  })

  return { container, server }
}
