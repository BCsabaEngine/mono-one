import { migrateService } from '@mono/shared-migrations'

await migrateService({
  serviceId: 'customer-service',
  migrationsFolder: process.env.MIGRATIONS_DIR ?? 'apps/customer-service/src/db/migrations'
})
