import { timestamp } from 'drizzle-orm/pg-core'

/** created_at / updated_at / deleted_at of every business table (deleted_at null = active, soft delete). */
export const businessColumns = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}
