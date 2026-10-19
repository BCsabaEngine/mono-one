import { integer, pgTable, text } from 'drizzle-orm/pg-core'
// eslint-disable-next-line @nx/enforce-module-boundaries -- drizzle-kit loads the schema without tsconfig paths, so no alias
import { businessTimestampColumnsSoftDelete } from '../../../../../libs/businessColumns'

export const user = pgTable('user', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(), // the login name, stored lowercase
  name: text('name').notNull(),
  password: text('password').notNull(), // hash only, see services/password.ts
  ...businessTimestampColumnsSoftDelete
})
