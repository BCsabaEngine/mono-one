import { migrateService } from '@mono/shared-migrations'

await migrateService({
  serviceId: 'order-service',
  migrationsFolder: process.env.MIGRATIONS_DIR ?? 'apps/order-service/src/db/migrations'
})
