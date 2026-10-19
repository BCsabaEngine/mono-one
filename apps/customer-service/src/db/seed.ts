import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { seedNumbers } from '@lib/seedIds'
import { address, contact, customer } from './schema'
import type * as schema from './schema'

const CODE_DIGITS = 4
const SEED_ADDRESS = { country: 'HU', zip: '1051', city: 'Budapest' } as const

/** Wipes the tables (identities restart at 1, so customer n has id n) and inserts one customer per n of the shared seed scale, each with an hq address and a sales contact. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.execute(
      sql`truncate table ${contact}, ${address}, ${customer} restart identity`
    )

    await tx.insert(customer).values(
      seedNumbers().map(n => ({
        code: `C-${String(n).padStart(CODE_DIGITS, '0')}`,
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
        ...SEED_ADDRESS,
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
