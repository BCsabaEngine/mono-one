import { z } from 'zod'
import { REDACTED, SERVICE_PORTS } from './constants'
import type { ServiceId } from './constants'

const DEFAULT_REQUEST_TIMEOUT_MS = 5000
const DEFAULT_EVENT_TIMEOUT_MS = 2500
const DEFAULT_DB_POOL_SIZE = 10
const DEFAULT_DB_SLOW_QUERY_MS = 500

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback)

const localUrl = (id: ServiceId) =>
  z.url().default(`http://localhost:${SERVICE_PORTS[id]}`)

/** The per-service part of a config schema: `baseEnvSchema.extend(serviceEnv('order-service'))`. */
export const serviceEnv = (id: ServiceId) => ({
  SERVICE_ID: z.string().default(id),
  PORT: positiveInt(SERVICE_PORTS[id])
})

export const commonEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  SERVICE_ID: z.string().min(1),
  PORT: positiveInt(SERVICE_PORTS.web),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  REQUEST_TIMEOUT_MS: positiveInt(DEFAULT_REQUEST_TIMEOUT_MS),
  EVENT_TIMEOUT_MS: positiveInt(DEFAULT_EVENT_TIMEOUT_MS),
  WEB_URL: localUrl('web'),
  CUSTOMER_SERVICE_URL: localUrl('customer-service'),
  ORDER_SERVICE_URL: localUrl('order-service'),
  DOCUMENT_SERVICE_URL: localUrl('document-service'),
  SYSTEM_SERVICE_URL: localUrl('system-service')
})

export const baseEnvSchema = commonEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  DB_SCHEMA: z.string().optional(),
  DB_POOL_SIZE: positiveInt(DEFAULT_DB_POOL_SIZE),
  DB_SLOW_QUERY_MS: positiveInt(DEFAULT_DB_SLOW_QUERY_MS)
})

export type CommonEnv = z.infer<typeof commonEnvSchema>
export type BaseEnv = z.infer<typeof baseEnvSchema>

const SECRET_KEY_PATTERN = /(PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL|REDIS_URL)/i

export const redactConfig = <T extends Record<string, unknown>>(
  config: T
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(config).map(([k, v]) => [
      k,
      SECRET_KEY_PATTERN.test(k) ? REDACTED : v
    ])
  )

/** Parses env with a Zod schema and fails fast with a readable message. */
export const loadConfig = <S extends z.ZodType>(
  schema: S,
  env: NodeJS.ProcessEnv = process.env
): z.infer<S> => {
  const parsed = schema.safeParse(env)
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues
    .map(i => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')

  throw new Error(`Invalid environment configuration:\n${issues}`)
}
