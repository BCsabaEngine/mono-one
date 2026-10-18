import type { Logger } from '@mono/shared-logging'
import { baseContextFromHeaders, createServiceServer } from '@mono/shared-trpc'
import { appRouter } from '@mono/order-api/server'
import type { Config } from './config'
import { asValue } from 'awilix'
import { buildContainer, type Cradle } from './container'
import { eventsRouter } from './events'
import { createContext } from './trpc/context'

/** Composition root shared by main.ts and the integration tests. */
export const createApp = (
  config: Config,
  log: Logger,
  overrides: Partial<Pick<Cradle, 'customerClient' | 'publisher'>> = {}
) => {
  const container = buildContainer(config, log)
  Object.entries(overrides).forEach(([name, value]) => container.register({ [name]: asValue(value) }))
  const server = createServiceServer({
    log,
    trpc: { router: appRouter, createContext: createContext(container) },
    events: { router: eventsRouter, createContext: headers => baseContextFromHeaders(headers, log) },
    ready: container.cradle.database.ping
  })
  return { container, server }
}
