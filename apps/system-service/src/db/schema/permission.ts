import { integer, pgTable, text, unique } from 'drizzle-orm/pg-core'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { PERMISSIONS } from '../../../../../libs/system-api/src/permissions'
import { user } from './user'

export const permission = pgTable(
  'permission',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name', { enum: PERMISSIONS }).notNull()
  },
  t => [unique().on(t.userId, t.name)] // the unique index also serves lookups by user_id
)
