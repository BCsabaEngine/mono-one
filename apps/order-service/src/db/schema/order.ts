import { sql } from 'drizzle-orm'
import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { businessTimestampColumnsSoftDelete } from '../../../../../libs/businessColumns'

export const order = pgTable(
  'order',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer('customer_id').notNull(), // owned by customer-service: no cross-service foreign key
    title: text('title').notNull(),
    comment: text('comment'),
    deliveryAddressId: integer('delivery_address_id').notNull(), // an address of that customer in customer-service: no cross-service foreign key
    ...businessTimestampColumnsSoftDelete
  },
  t => [
    // orders.list: active orders of a customer, newest first
    index('order_customer_id_id_idx')
      .on(t.customerId, t.id.desc())
      .where(sql`${t.deletedAt} is null`)
  ]
)
