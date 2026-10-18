// kept free of workspace-alias imports: drizzle-kit loads drizzle.config.ts without tsconfig paths
/** One-line drizzle.config.ts for a service. */
export const defineDrizzleConfig = ({ schema, out }: { schema: string; out: string }) =>
  ({ dialect: 'postgresql', schema, out, dbCredentials: { url: process.env.DATABASE_URL ?? '' } }) as const
