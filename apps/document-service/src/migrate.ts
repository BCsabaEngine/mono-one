import { migrateService } from '@lib/migrations'

await migrateService({
  serviceId: 'document-service',
  migrationsFolder: process.env.MIGRATIONS_DIR ?? 'apps/document-service/src/db/migrations'
})
