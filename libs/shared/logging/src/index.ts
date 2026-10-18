import { pino, type Logger } from 'pino'

export type { Logger }

export interface LoggerOptions {
  service: string
  level?: string
  pretty?: boolean
  version?: string
}

export const createLogger = ({ service, level = 'info', pretty = false, version }: LoggerOptions): Logger =>
  pino({
    level,
    base: { service, version: version ?? process.env.APP_VERSION },
    redact: {
      paths: ['req.headers.authorization', '*.jwt', '*.password', '*.token', '*.secret'],
      censor: '[redacted]'
    },
    ...(pretty && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname,service', singleLine: true }
      }
    })
  })

export const withRequestId = (log: Logger, requestId: string): Logger => log.child({ requestId })
