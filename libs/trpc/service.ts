import type { IncomingHttpHeaders, Server } from 'node:http'
import { asFunction, asValue } from 'awilix'
import type { AwilixContainer } from 'awilix'
import type { AnyTRPCRouter } from '@trpc/server'
import { TRPC_PATH } from '../constants'
import { redactConfig } from '../config'
import type { CommonEnv } from '../config'
import { createDb } from '../db'
import type { DbConfig } from '../db'
import { createLogger } from '../logging'
import type { Logger } from '../logging'
import { createServiceClient } from './client'
import { baseContextFromHeaders } from './context'
import { shutdownOnSignal } from './server'

type ServiceUrlKey = {
  [K in keyof CommonEnv]: K extends `${string}_URL` ? K : never
}[keyof CommonEnv]

/** The entry point of a service (main.ts): config, logger, app, graceful shutdown, listen. */
export const runService = <C extends CommonEnv>({
  loadConfig,
  createApp
}: {
  loadConfig: () => C
  createApp: (
    config: C,
    log: Logger
  ) => { container: { dispose: () => Promise<void> }; server: Server }
}) => {
  const config = loadConfig()

  const log = createLogger({
    service: config.SERVICE_ID,
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === 'development'
  })

  log.info({ port: config.PORT }, 'starting')
  log.debug({ config: redactConfig(config) }, 'config')

  const { container, server } = createApp(config, log)

  shutdownOnSignal(server, log, () => container.dispose())
  server.listen(config.PORT, () => log.info({ port: config.PORT }, 'listening'))
}

type Cradle = { config: CommonEnv; log: Logger }

// a built container's type is an intersection of its Dependencies and the inferred resolvers; callers name `D` (their Dependencies)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContainer = AwilixContainer<any>

/** Base context plus a scoped container (carrying the trace logger) for one request. */
export const scopedContext = <D extends Cradle>(
  container: AnyContainer,
  headers: IncomingHttpHeaders
) => {
  const { log, config } = (container as AwilixContainer<D>).cradle

  const base = baseContextFromHeaders(headers, log, config.SERVICE_ID)

  const scope = (container as AwilixContainer<D>).createScope<D>()
  scope.register({ log: asValue(base.log) } as never) // the scope's own logger, carrying traceId and callChain

  return { base, services: scope.cradle }
}

/** Replaces dependencies by value (tests: fake clients, publishers). */
export const applyOverrides = (
  container: AnyContainer,
  overrides: Record<string, unknown>
) =>
  Object.entries(overrides).forEach(([name, value]) =>
    container.register({ [name]: asValue(value) })
  )

/** `config` and `log` registrations every service container starts with. */
export const baseRegistrations = <C extends CommonEnv>(
  config: C,
  log: Logger
) => ({ config: asValue(config), log: asValue(log) })

/** One pg pool per service, closed by `container.dispose()` on shutdown. */
export const databaseRegistration = <TSchema extends Record<string, unknown>>(
  schema: TSchema
) =>
  asFunction(({ config, log }: { config: DbConfig; log: Logger }) =>
    createDb(config, log, schema)
  )
    .singleton()
    .disposer(d => d.close())

/** Typed client for another service, called on `urlKey` (e.g. `ORDER_SERVICE_URL`). */
export const serviceClientRegistration = <R extends AnyTRPCRouter>(
  urlKey: ServiceUrlKey
) =>
  asFunction(({ config }: { config: CommonEnv }) =>
    createServiceClient<R>({
      url: `${config[urlKey]}${TRPC_PATH}`,
      serviceId: config.SERVICE_ID,
      timeoutMs: config.REQUEST_TIMEOUT_MS
    })
  ).singleton()
