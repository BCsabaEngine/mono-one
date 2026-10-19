import { pino } from 'pino'
import type { Logger } from 'pino'
import { REDACTED } from './constants'

export type { Logger }

export interface LoggerOptions {
  service: string
  level?: string
  version?: string
}

export const createLogger = ({
  service,
  level = 'info',
  version
}: LoggerOptions): Logger =>
  pino({
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
  })

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
