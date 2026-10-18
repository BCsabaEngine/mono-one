import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { SEED_SCALE, seedId, seedIds } from '@lib/seedIds'
import { orders } from './schema'
import type * as schema from './schema'

/** Wipes the orders table and inserts one order per id of the shared seed scale, each for the customer with the same n. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.delete(orders)
    await tx.insert(orders).values(
      seedIds('order').map((id, i) => ({
        id,
        customerId: seedId('customer', SEED_SCALE.min + i),
        customerName: `Customer ${SEED_SCALE.min + i}`, // same name as customer-service's seeder
        totalCents: (SEED_SCALE.min + i) * 100
      }))
    )
  })
