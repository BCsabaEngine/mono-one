import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { BaseEnv } from '@mono/shared-config'
import type { Logger } from '@mono/shared-logging'

export type DbConfig = Pick<BaseEnv, 'DATABASE_URL' | 'DB_SCHEMA' | 'DB_POOL_SIZE' | 'DB_SLOW_QUERY_MS'>

export const createDb = <TSchema extends Record<string, unknown> = Record<string, never>>(
  config: DbConfig,
  log: Logger,
  schema?: TSchema
) => {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_SIZE,
    ...(config.DB_SCHEMA && { options: `-c search_path=${config.DB_SCHEMA}` })
  })
  pool.on('error', err => log.error({ err }, 'pg pool error'))

  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>
  pool.query = (async (...args: unknown[]) => {
    const start = performance.now()
    try {
      return await query(...args)
    } finally {
      const ms = Math.round(performance.now() - start)
      if (ms > config.DB_SLOW_QUERY_MS) log.warn({ ms }, 'slow query')
    }
  }) as typeof pool.query

  const db: NodePgDatabase<TSchema> = drizzle(pool, {
    ...(schema && { schema }),
    logger: { logQuery: query => log.debug({ query }, 'sql') } // parameters deliberately not logged
  })

  return {
    db,
    pool,
    withTransaction: <T>(fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>) =>
      db.transaction(fn),
    ping: async () => void (await pool.query('select 1')),
    close: () => pool.end()
  }
}

export type Db<TSchema extends Record<string, unknown> = Record<string, never>> = ReturnType<typeof createDb<TSchema>>
