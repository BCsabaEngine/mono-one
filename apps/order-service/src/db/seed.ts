import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { seedNumbers } from '@lib/seedIds'
import { order, orderDetail } from './schema'
import type * as schema from './schema'

const CODE_DIGITS = 4
const CENTS = 100
const DETAIL_LINES = [1, 2]

/** Wipes the tables (identities restart at 1, so order n has id n) and inserts one order per n of the shared seed scale, each for the customer with the same n, delivered to its hq address (customer-service seeds exactly one address per customer, so address n) and with two details. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.execute(
      sql`truncate table ${orderDetail}, ${order} restart identity`
    )

    const orders = await tx
      .insert(order)
      .values(
        seedNumbers().map(n => ({
          customerId: n,
          title: `Order ${n}`,
          deliveryAddressId: n
        }))
      )
      .returning({ id: order.id })

    await tx.insert(orderDetail).values(
      orders.flatMap(({ id }) =>
        DETAIL_LINES.map(line => ({
          orderId: id,
          productCode: `P-${String(line).padStart(CODE_DIGITS, '0')}`,
          productName: `Product ${line}`,
          quantity: line,
          unitPrice: id * CENTS,
          netValue: line * id * CENTS
        }))
      )
    )
  })
