import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { SEED_SCALE } from '@lib/seedIds'
import { order, orderDetail } from './schema'
import type * as schema from './schema'

/** Wipes the tables (identities restart at 1, so order n has id n) and inserts one order per n of the shared seed scale, each for the customer with the same n, delivered to its hq address (customer-service seeds exactly one address per customer, so address n) and with two details. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.execute(
      sql`truncate table ${orderDetail}, ${order} restart identity`
    )

    const ns = Array.from(
      { length: SEED_SCALE.max - SEED_SCALE.min + 1 },
      (_, i) => SEED_SCALE.min + i
    )

    const orders = await tx
      .insert(order)
      .values(
        ns.map(n => ({
          customerId: n,
          title: `Order ${n}`,
          deliveryAddressId: n
        }))
      )
      .returning({ id: order.id })

    await tx.insert(orderDetail).values(
      orders.flatMap(({ id }) =>
        [1, 2].map(line => ({
          orderId: id,
          productCode: `P-${String(line).padStart(4, '0')}`,
          productName: `Product ${line}`,
          quantity: line,
          unitPrice: id * 100,
          netValue: line * id * 100
        }))
      )
    )
  })
