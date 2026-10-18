import { z } from 'zod'
import { commonEnvSchema, loadConfig } from '@lib/config'

// no database: documents are rendered on demand from order-service and customer-service data
const schema = commonEnvSchema.extend({
  SERVICE_ID: z.string().default('document-service'),
  PORT: z.coerce.number().int().positive().default(3003)
})

export type Config = z.infer<typeof schema>
export const loadServiceConfig = (): Config => loadConfig(schema)
