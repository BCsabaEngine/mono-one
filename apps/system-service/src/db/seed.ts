import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { PERMISSIONS } from '@lib/permissions'
import { hashPassword } from '../services/password'
import { permission, user } from './schema'
import type * as schema from './schema'

const STARTER_USER = {
  email: 'hello@mono.hu',
  name: 'Hello',
  password: 'hello'
}

/** Wipes the tables (identities restart at 1) and inserts the starter user, id 1, with every permission. */
export const seed = (db: NodePgDatabase<typeof schema>) =>
  db.transaction(async tx => {
    await tx.execute(
      sql`truncate table ${permission}, ${user} restart identity`
    )

    const [hello] = await tx
      .insert(user)
      .values({
        ...STARTER_USER,
        password: hashPassword(STARTER_USER.password)
      })
      .returning({ id: user.id })

    await tx
      .insert(permission)
      .values(PERMISSIONS.map(name => ({ userId: hello!.id, name })))
  })
