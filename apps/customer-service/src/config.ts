import type { z } from 'zod'
import { baseEnvSchema, loadConfig, serviceEnv } from '@lib/config'
import { databaseUrlEnv } from '@lib/databaseUrl'

const schema = baseEnvSchema.extend(serviceEnv('customer-service'))

export type Config = z.infer<typeof schema>
export const loadServiceConfig = (): Config =>
  loadConfig(schema, databaseUrlEnv('customer-service'))
