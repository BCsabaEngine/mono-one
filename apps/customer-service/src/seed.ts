import { seedService } from '@lib/seeding'
import * as schema from './db/schema'
import { seed } from './db/seed'

await seedService({ serviceId: 'customer-service', schema, run: seed })
