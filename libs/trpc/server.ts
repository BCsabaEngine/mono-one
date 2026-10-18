import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server'
import type { Logger } from '../logging'

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
  trpc: Mount<A>
  events: Mount<E>
  /** readiness probe, e.g. the database ping */
  ready: () => Promise<void>
}

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
  trpc,
  events,
  ready
}: ServiceServerOptions<A, E>): Server => {
  const trpcHandler = createHTTPHandler({
    basePath: '/trpc/',
    router: trpc.router,
    createContext: ({ req }) => trpc.createContext(req.headers)
  })

  const eventsHandler = createHTTPHandler({
    basePath: '/events/',
    router: events.router,
    createContext: ({ req }) => events.createContext(req.headers)
  })

  return createServer((req, res) => {
    const url = req.url ?? '/'

    if (url === '/healthz') return json(res, 200, { status: 'ok' })
    if (url === '/readyz')
      return void ready().then(
        () => json(res, 200, { status: 'ready' }),
        err => (
          log.warn({ err }, 'not ready'),
          json(res, 503, { status: 'unavailable' })
        )
      )

    if (url.startsWith('/trpc/')) return trpcHandler(req, res)
    if (url.startsWith('/events/')) return eventsHandler(req, res)

    json(res, 404, { error: 'not found' })
  })
}

/** SIGTERM/SIGINT: stop accepting connections, drain, then run cleanups (pg pool, container dispose). */
export const shutdownOnSignal = (
  server: Server,
  log: Logger,
  cleanup: () => Promise<unknown>
) => {
  const stop = (signal: string) => {
    log.info({ signal }, 'shutting down')

    server.close(() =>
      cleanup().then(
        () => process.exit(0),
        err => (log.error({ err }, 'cleanup failed'), process.exit(1))
      )
    )

    server.closeIdleConnections()
  }

  process.once('SIGTERM', () => stop('SIGTERM'))
  process.once('SIGINT', () => stop('SIGINT'))
}
