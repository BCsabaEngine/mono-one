import { z } from 'zod'

export const commonEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  SERVICE_ID: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  EVENT_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  WEB_URL: z.url().default('http://localhost:3000'),
  CUSTOMER_SERVICE_URL: z.url().default('http://localhost:3001'),
  ORDER_SERVICE_URL: z.url().default('http://localhost:3002'),
  DOCUMENT_SERVICE_URL: z.url().default('http://localhost:3003'),
  SYSTEM_SERVICE_URL: z.url().default('http://localhost:3004')
})

export const baseEnvSchema = commonEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  DB_SCHEMA: z.string().optional(),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DB_SLOW_QUERY_MS: z.coerce.number().int().positive().default(500)
})

export type CommonEnv = z.infer<typeof commonEnvSchema>
export type BaseEnv = z.infer<typeof baseEnvSchema>

const SECRET_KEY = /(PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL|REDIS_URL)/i

export const redactConfig = <T extends Record<string, unknown>>(
  config: T
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(config).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? '[redacted]' : v
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
