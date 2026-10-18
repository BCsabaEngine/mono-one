import { z } from 'zod'
import { baseEnvSchema, loadConfig } from '@mono/shared-config'

const schema = baseEnvSchema.extend({
  SERVICE_ID: z.string().default('document-service'),
  PORT: z.coerce.number().int().positive().default(3003)
})

export type Config = z.infer<typeof schema>
export const loadServiceConfig = (): Config => loadConfig(schema)
