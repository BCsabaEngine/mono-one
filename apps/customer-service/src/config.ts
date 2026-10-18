import { z } from 'zod'
import { baseEnvSchema, loadConfig } from '@lib/config'

const schema = baseEnvSchema.extend({
  SERVICE_ID: z.string().default('customer-service'),
  PORT: z.coerce.number().int().positive().default(3001)
})

export type Config = z.infer<typeof schema>
export const loadServiceConfig = (): Config => loadConfig(schema)
