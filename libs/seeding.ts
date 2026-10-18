import { baseEnvSchema, loadConfig } from './config'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createDb } from './db'
import { createLogger } from './logging'

/**
 * Standard `seed` entry point: each service calls this from its own src/seed.ts.
 * `run` wipes the service's tables and inserts the seed data (in one transaction of its own). Never for production.
 */
export const seedService = async <TSchema extends Record<string, unknown>>({
  serviceId,
  schema,
  run
}: {
  serviceId: string
  schema: TSchema
  run: (db: NodePgDatabase<TSchema>) => Promise<void>
}) => {
  const config = loadConfig(baseEnvSchema, {
    SERVICE_ID: serviceId,
    ...process.env
  })
  if (config.NODE_ENV === 'production')
    throw new Error('Refusing to seed: NODE_ENV is production')
  const logger = createLogger({
    service: serviceId,
    level: config.LOG_LEVEL
  })
  const { db, close } = createDb(config, logger, schema)
  try {
    await run(db)
    logger.info('seed done')
  } finally {
    await close()
  }
}
