import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { seedIds } from '@lib/seedIds'
import { customers } from './schema'
import type * as schema from './schema'

/** Wipes the customers table and inserts one customer per id of the shared seed scale. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.delete(customers)
    await tx.insert(customers).values(
      seedIds('customer').map((id, i) => ({
        id,
        name: `Customer ${i + 1}`,
        email: `customer-${i + 1}@example.com`
      }))
    )
  })
