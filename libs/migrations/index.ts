import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Pool } from 'pg'
import { baseEnvSchema, loadConfig } from '../config'
import { createDb } from '../db'
import { createLogger } from '../logging'
import type { Logger } from '../logging'

export { defineDrizzleConfig } from './drizzle-config'

const LOCK_KEY = 7_411_001 // arbitrary app-wide advisory lock id

const appliedCount = async (pool: Pool) =>
  pool.query('select count(*)::int as n from drizzle.__drizzle_migrations').then(
    r => r.rows[0].n as number,
    () => 0 // table does not exist yet
  )

export const runMigrations = async ({ pool, migrationsFolder, logger }: { pool: Pool; migrationsFolder: string; logger: Logger }) => {
  const client = await pool.connect()
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY])
    const before = await appliedCount(pool)
    await migrate(drizzle(client), { migrationsFolder })
    logger.info({ applied: (await appliedCount(pool)) - before, migrationsFolder }, 'migrations done')
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined)
    client.release()
  }
}

/** Standard `migrate` entry point: each service calls this from its own src/migrate.ts. */
export const migrateService = async ({ serviceId, migrationsFolder }: { serviceId: string; migrationsFolder: string }) => {
  const config = loadConfig(baseEnvSchema, { SERVICE_ID: serviceId, ...process.env })
  const logger = createLogger({ service: serviceId, level: config.LOG_LEVEL, pretty: config.NODE_ENV === 'development' })
  const { pool, close } = createDb(config, logger)
  try {
    await runMigrations({ pool, migrationsFolder, logger })
  } finally {
    await close()
  }
}
