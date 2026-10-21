import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { baseEnvSchema, loadConfig } from './config'
import { databaseUrlEnv } from './databaseUrl'
import type { BaseEnv } from './config'
import { createLogger, currentLog } from './logging'
import type { Logger } from './logging'

export type DbConfig = Pick<
  BaseEnv,
  | 'DATABASE_URL'
  | 'DB_SCHEMA'
  | 'DB_POOL_SIZE'
  | 'DB_SLOW_QUERY_MS'
  | 'DB_CONNECTION_TIMEOUT_MS'
  | 'DB_IDLE_TIMEOUT_MS'
  | 'DB_STATEMENT_TIMEOUT_MS'
>

export const createDb = <
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  config: DbConfig,
  log: Logger,
  schema?: TSchema
) => {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_SIZE,
    connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: config.DB_IDLE_TIMEOUT_MS,
    statement_timeout: config.DB_STATEMENT_TIMEOUT_MS,
    ...(config.DB_SCHEMA && { options: `-c search_path=${config.DB_SCHEMA}` })
  })

  pool.on('error', err => log.error({ err }, 'pg pool error'))

  const query = pool.query.bind(pool) as (
    ...args: unknown[]
  ) => Promise<unknown>

  pool.query = (async (...args: unknown[]) => {
    const start = performance.now()

    try {
      return await query(...args)
    } finally {
      const ms = Math.round(performance.now() - start)

      if (ms > config.DB_SLOW_QUERY_MS)
        currentLog(log).warn({ ms }, 'slow query')
    }
  }) as typeof pool.query

  const db: NodePgDatabase<TSchema> = drizzle(pool, {
    ...(schema && { schema }),
    logger: { logQuery: query => currentLog(log).trace({ query }, 'sql') } // parameters deliberately not logged
  })

  return {
    db,
    pool,
    withTransaction: <T>(
      fn: (
        tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
      ) => Promise<T>
    ) => {
      const start = performance.now()

      return db.transaction(fn).finally(() => {
        const ms = Math.round(performance.now() - start)

        if (ms > config.DB_SLOW_QUERY_MS)
          currentLog(log).warn({ ms }, 'slow transaction')
      })
    },
    ping: async () => void (await pool.query('select 1')),
    close: () => pool.end()
  }
}

export type Db<
  TSchema extends Record<string, unknown> = Record<string, never>
> = ReturnType<typeof createDb<TSchema>>

/** Config, logger and database of a service for a one-off script (migrate, seed); the pool is closed afterwards. */
export const withServiceDb = async <
  T,
  TSchema extends Record<string, unknown> = Record<string, never>
>(
  serviceId: string,
  run: (ctx: { config: BaseEnv; log: Logger } & Db<TSchema>) => Promise<T>,
  schema?: TSchema
) => {
  const config = loadConfig(baseEnvSchema, {
    SERVICE_ID: serviceId,
    ...databaseUrlEnv(serviceId)
  })

  const log = createLogger({
    service: serviceId,
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === 'development'
  })
  const database = createDb(config, log, schema)

  try {
    return await run({ config, log, ...database })
  } finally {
    await database.close()
  }
}
