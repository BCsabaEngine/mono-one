import { timestamp } from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
}

/** created_at / updated_at / deleted_at of every business table (deleted_at null = active, soft delete). */
export const businessTimestampColumnsSoftDelete = {
  ...timestamps,
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}

/** created_at / updated_at only, for tables that are hard deleted. */
export const businessTimestampColumns = timestamps
