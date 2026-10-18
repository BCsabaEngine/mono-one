import { sql } from 'drizzle-orm'
import { integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { businessTimestampColumnsSoftDelete } from '../../../../../libs/businessColumns'

export const customer = pgTable(
  'customer',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    comment: text('comment'),
    ...businessTimestampColumnsSoftDelete
  },
  t => [
    uniqueIndex('customer_code_active_key')
      .on(t.code)
      .where(sql`${t.deletedAt} is null`)
  ] // a deleted customer frees its code
)
