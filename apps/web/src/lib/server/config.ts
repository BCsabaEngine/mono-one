import { z } from 'zod'
import { commonEnvSchema, loadConfig } from '@lib/config'

const schema = commonEnvSchema.extend({
	SERVICE_ID: z.string().default('web'),
	REDIS_URL: z.string().default('redis://localhost:6379'),
	JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3600)
})

let config: z.infer<typeof schema> | undefined
// reads process.env: set by the container, or by `node --env-file` in `nx serve web`
export const getConfig = () => (config ??= loadConfig(schema))
