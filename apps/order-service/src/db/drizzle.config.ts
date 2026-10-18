// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads this file without tsconfig paths, so no alias
import { defineDrizzleConfig } from '../../../../libs/migrations/drizzle-config'

export default defineDrizzleConfig({
  schema: './apps/order-service/src/db/schema/index.ts',
  out: './apps/order-service/src/db/migrations'
})
