import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { SEED_SCALE } from '@lib/seedIds'
import { address, contact, customer } from './schema'
import type * as schema from './schema'

/** Wipes the tables (identities restart at 1, so customer n has id n) and inserts one customer per n of the shared seed scale, each with an hq address and a sales contact. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.execute(
      sql`truncate table ${contact}, ${address}, ${customer} restart identity`
    )

    const ns = Array.from(
      { length: SEED_SCALE.max - SEED_SCALE.min + 1 },
      (_, i) => SEED_SCALE.min + i
    )

    await tx.insert(customer).values(
      ns.map(n => ({
        code: `C-${String(n).padStart(4, '0')}`,
        name: `Customer ${n}`
      }))
    )

    const ids = (
      await tx.select({ id: customer.id }).from(customer).orderBy(customer.id)
    ).map(r => r.id)

    await tx.insert(address).values(
      ids.map(customerId => ({
        customerId,
        type: 'hq' as const,
        country: 'HU' as const,
        zip: '1051',
        city: 'Budapest',
        address: `Example utca ${customerId}`
      }))
    )

    await tx.insert(contact).values(
      ids.map(customerId => ({
        customerId,
        type: 'sales' as const,
        name: `Sales ${customerId}`,
        email: `sales-${customerId}@example.com`
      }))
    )
  })
