import { bigint, index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { order } from './order'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { businessTimestampColumns } from '../../../../../libs/businessColumns'

/** Money columns are in minor units (e.g. cents); `net_value` = `quantity` * `unit_price`, set by the service. */
export const orderDetail = pgTable(
  'order_detail',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    productCode: text('product_code').notNull(), // the product is not a foreign key: code and name are copied
    productName: text('product_name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
    netValue: bigint('net_value', { mode: 'number' }).notNull(),
    ...businessTimestampColumns
  },
  t => [index('order_detail_order_id_id_idx').on(t.orderId, t.id)] // details of an order in id order; also serves the cascade by order_id
)
