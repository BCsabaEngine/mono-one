import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import {
  ADDRESS_TYPES,
  EU_COUNTRIES
} from '../../../../../libs/customer-api/src/domain'
import { customer } from './customer'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { businessColumns } from '../../../../../libs/businessColumns'

export const address = pgTable(
  'address',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ADDRESS_TYPES }).notNull(),
    name: text('name'),
    country: text('country', { enum: EU_COUNTRIES }).notNull(),
    zip: text('zip').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    ...businessColumns
  },
  t => [index('address_customer_id_idx').on(t.customerId)]
)
