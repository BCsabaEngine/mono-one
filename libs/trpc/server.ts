import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server'
import {
  EVENTS_PATH,
  HEALTH_PATH,
  READY_PATH,
  SHUTDOWN_DRAIN_MS,
  TRPC_PATH
} from '../constants'
import type { Logger } from '../logging'
import { baseContextFromHeaders } from './context'

type Mount<R extends AnyTRPCRouter> = {
  router: R
  createContext: (
    headers: IncomingMessage['headers']
  ) => inferRouterContext<R> | Promise<inferRouterContext<R>>
}

export interface ServiceServerOptions<
  A extends AnyTRPCRouter,
  E extends AnyTRPCRouter
> {
  log: Logger
  /** appended to the call chain of incoming requests */
  serviceId: string
  trpc: Mount<A>
  /** events are always mounted with the plain base context */
  events: E
  /** readiness probe, e.g. the database ping */
  ready: () => Promise<void>
}

/** Servers that received a shutdown signal: their readiness probe answers 503 so traffic moves away while they drain. */
const draining = new WeakSet<Server>()

const json = (res: ServerResponse, status: number, body: unknown) =>
  res
    .writeHead(status, { 'content-type': 'application/json' })
    .end(JSON.stringify(body))

/** node:http server: /healthz, /readyz, tRPC domain router on /trpc, events.deliver router on /events. */
export const createServiceServer = <
  A extends AnyTRPCRouter,
  E extends AnyTRPCRouter
>({
  log,
  serviceId,
  trpc,
  events,
  ready
}: ServiceServerOptions<A, E>): Server => {
  const trpcHandler = createHTTPHandler({
    basePath: `${TRPC_PATH}/`,
    router: trpc.router,
    createContext: ({ req }) => trpc.createContext(req.headers)
  })

  const eventsHandler = createHTTPHandler({
    basePath: `${EVENTS_PATH}/`,
    router: events,
    createContext: ({ req }) =>
      baseContextFromHeaders(req.headers, log, serviceId)
  })

  const server: Server = createServer((req, res) => {
    const url = req.url ?? '/'

    if (url === HEALTH_PATH) return json(res, 200, { status: 'ok' })
    if (url === READY_PATH) {
      if (draining.has(server)) return json(res, 503, { status: 'draining' })

      return void ready().then(
        () => json(res, 200, { status: 'ready' }),
        err => (
          log.warn({ err }, 'not ready'),
          json(res, 503, { status: 'unavailable' })
        )
      )
    }

    if (url.startsWith(`${TRPC_PATH}/`)) return trpcHandler(req, res)
    if (url.startsWith(`${EVENTS_PATH}/`)) return eventsHandler(req, res)

    json(res, 404, { error: 'not found' })
  })

  return server
}

/** SIGTERM/SIGINT: stop accepting connections, drain, then run cleanups (pg pool, container dispose). */
export const shutdownOnSignal = (
  server: Server,
  log: Logger,
  cleanup: () => Promise<unknown>
) => {
  const stop = (signal: string) => {
    log.info({ signal }, 'shutting down')
    draining.add(server)

    server.close(() =>
      cleanup().then(
        () => process.exit(0),
        err => (log.error({ err }, 'cleanup failed'), process.exit(1))
      )
    )

    server.closeIdleConnections()
    setTimeout(() => server.closeAllConnections(), SHUTDOWN_DRAIN_MS).unref()
  }

  process.once('SIGTERM', () => stop('SIGTERM'))
  process.once('SIGINT', () => stop('SIGINT'))
}
