import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Pool } from 'pg'
import { DEFAULT_DB_SCHEMA } from '../constants'
import { withServiceDb } from '../db'
import type { Logger } from '../logging'

export { defineDrizzleConfig } from './drizzle-config'

const MIGRATION_LOCK_KEY = 7_411_001 // arbitrary app-wide advisory lock id

const appliedCount = async (pool: Pool, schema: string) =>
  pool
    .query(`select count(*)::int as n from "${schema}".__drizzle_migrations`)
    .then(
      r => r.rows[0].n as number,
      () => 0 // table does not exist yet
    )

export const runMigrations = async ({
  pool,
  migrationsFolder,
  logger,
  schema = DEFAULT_DB_SCHEMA
}: {
  pool: Pool
  migrationsFolder: string
  logger: Logger
  schema?: string
}) => {
  const client = await pool.connect()

  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])

    const before = await appliedCount(pool, schema)
    await migrate(drizzle(client), {
      migrationsFolder,
      migrationsSchema: schema
    })

    logger.info(
      { applied: (await appliedCount(pool, schema)) - before, migrationsFolder },
      'migrations done'
    )
  } finally {
    await client
      .query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
      .catch(() => undefined)
    client.release()
  }
}

/** Standard `migrate` entry point: each service calls this from its own src/migrate.ts. */
export const migrateService = (serviceId: string) =>
  withServiceDb(serviceId, ({ config, log, pool }) =>
    runMigrations({
      pool,
      logger: log,
      migrationsFolder:
        process.env.MIGRATIONS_DIR ?? `apps/${serviceId}/src/db/migrations`,
      schema: config.DB_SCHEMA ?? DEFAULT_DB_SCHEMA
    })
  )
