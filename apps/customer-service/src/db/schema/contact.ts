import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { CONTACT_TYPES } from '../../../../../libs/domain'
import { customer } from './customer'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { businessTimestampColumnsSoftDelete } from '../../../../../libs/businessColumns'

export const contact = pgTable(
  'contact',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    type: text('type', { enum: CONTACT_TYPES }).notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    ...businessTimestampColumnsSoftDelete
  },
  t => [index('contact_customer_id_id_idx').on(t.customerId, t.id)] // children of a customer in id order; also serves the cascade by customer_id
)
