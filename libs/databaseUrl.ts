// import-free: drizzle-kit loads drizzle.config.ts (and through it this file) without tsconfig paths
/**
 * Env of a service with its `DATABASE_URL` filled from `DATABASE_URL_<SERVICE_ID>` (e.g. `DATABASE_URL_ORDER_SERVICE`),
 * so one root `.env` can hold every service's database in dev. An explicit `DATABASE_URL` wins (containers).
 */
export const databaseUrlEnv = (
  serviceId: string,
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv => ({
  DATABASE_URL:
    env[`DATABASE_URL_${serviceId.toUpperCase().replaceAll('-', '_')}`],
  ...env
})
