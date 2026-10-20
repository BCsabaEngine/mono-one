import { AsyncLocalStorage } from 'node:async_hooks'
// aliased: the esbuild banner (nx.json) already declares `createRequire` at the top of every service bundle
import { createRequire as makeRequire } from 'node:module'
import { pino } from 'pino'
import type { Logger } from 'pino'
import { REDACTED } from './constants'

export type { Logger }

export interface LoggerOptions {
  service: string
  level?: string
  version?: string
  /** dev only: human-readable lines without time, pid, hostname, service and version */
  pretty?: boolean
}

const SHORT_TRACE_ID_LENGTH = 8

// loaded on demand (a devDependency, not part of the bundled images)
const prettyStream = () =>
  makeRequire(import.meta.url)('pino-pretty').default({
    colorize: true,
    ignore: 'pid,hostname,time,service,version,userId',
    customPrettifiers: {
      traceId: (id: unknown) => String(id).slice(0, SHORT_TRACE_ID_LENGTH)
    }
  })

export const createLogger = ({
  service,
  level = 'info',
  version,
  pretty
}: LoggerOptions): Logger =>
  pino(
    {
      level,
      base: { service, version: version ?? process.env.APP_VERSION },
      redact: {
        paths: [
          'req.headers.authorization',
          '*.jwt',
          '*.password',
          '*.token',
          '*.secret'
        ],
        censor: REDACTED
      }
    },
    pretty ? prettyStream() : undefined
  )

const requestLog = new AsyncLocalStorage<Logger>()

/** Runs `fn` with the request's trace logger as the current one (see `currentLog`). */
export const runWithLog = <T>(log: Logger, fn: () => T): T =>
  requestLog.run(log, fn)

/** The trace logger of the request being served, else `fallback`: lets code without a request logger (the db layer) log with traceId and callChain. */
export const currentLog = (fallback: Logger): Logger =>
  requestLog.getStore() ?? fallback

export interface TraceFields {
  traceId: string
  /** services the request passed through so far, caller first, this service last */
  callChain: string[]
  userId?: string | undefined
}

/** Child logger carrying the correlation fields: `callChain` is logged as `web>order-service`. */
export const withTrace = (
  log: Logger,
  { traceId, callChain, userId }: TraceFields
): Logger =>
  log.child({
    traceId,
    callChain: callChain.join('>'),
    ...(userId && { userId })
  })
