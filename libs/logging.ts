import { pino } from 'pino'
import type { Logger } from 'pino'

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
      censor: '[redacted]'
    }
  })

export const withRequestId = (log: Logger, requestId: string): Logger =>
  log.child({ requestId })
