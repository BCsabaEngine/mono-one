// kept free of workspace-alias imports: drizzle-kit loads drizzle.config.ts without tsconfig paths
import { databaseUrlEnv } from '../databaseUrl'

/** One-line drizzle.config.ts for a service: `defineDrizzleConfig('order-service')`. */
export const defineDrizzleConfig = (serviceId: string) =>
  ({
    dialect: 'postgresql',
    schema: `./apps/${serviceId}/src/db/schema/index.ts`,
    out: `./apps/${serviceId}/src/db/migrations`,
    dbCredentials: { url: databaseUrlEnv(serviceId).DATABASE_URL ?? '' }
  }) as const
