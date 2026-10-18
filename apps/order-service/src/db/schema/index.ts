import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull(), // owned by customer-service: no cross-service foreign key
  customerName: text('customer_name').notNull(),
  totalCents: integer('total_cents').notNull(),
  status: text('status', { enum: ['placed'] })
    .notNull()
    .default('placed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
