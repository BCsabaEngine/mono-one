import { migrateService } from '@lib/migrations'

await migrateService({
  serviceId: 'system-service',
  migrationsFolder:
    process.env.MIGRATIONS_DIR ?? 'apps/system-service/src/db/migrations'
})
