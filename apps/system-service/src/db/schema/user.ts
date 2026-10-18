import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(), // the login name, stored lowercase
  name: text('name').notNull(),
  password: text('password').notNull(), // hash only, see services/password.ts
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
  updated: timestamp('updated', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deleted: timestamp('deleted', { withTimezone: true }) // null = active (soft delete)
})
