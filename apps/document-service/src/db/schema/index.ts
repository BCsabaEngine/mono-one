import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: integer('order_id').notNull().unique(), // owned by order-service: no cross-service foreign key
  kind: text('kind', { enum: ['order-confirmation'] })
    .notNull()
    .default('order-confirmation'),
  status: text('status', { enum: ['generated'] })
    .notNull()
    .default('generated'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})
