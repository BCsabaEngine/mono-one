import type { z } from 'zod'
import { commonEnvSchema, loadConfig, serviceEnv } from '@lib/config'

// no database: documents are rendered on demand from order-service and customer-service data
const schema = commonEnvSchema.extend(serviceEnv('document-service'))

export type Config = z.infer<typeof schema>
export const loadServiceConfig = (): Config => loadConfig(schema)
