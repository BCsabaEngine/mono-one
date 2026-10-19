import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { withServiceDb } from './db'

/**
 * Standard `seed` entry point: each service calls this from its own src/seed.ts.
 * `run` wipes the service's tables and inserts the seed data (in one transaction of its own). Never for production.
 */
export const seedService = <TSchema extends Record<string, unknown>>({
  serviceId,
  schema,
  run
}: {
  serviceId: string
  schema: TSchema
  run: (db: NodePgDatabase<TSchema>) => Promise<void>
}) =>
  withServiceDb(
    serviceId,
    async ({ config, log, db }) => {
      if (config.NODE_ENV === 'production')
        throw new Error('Refusing to seed: NODE_ENV is production')

      await run(db)
      log.info('seed done')
    },
    schema
  )
