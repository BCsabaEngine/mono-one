import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import {
  conflict,
  isUniqueViolation,
  notFound,
  unauthorized
} from '@lib/errors'
import { PERMISSIONS } from '@lib/permissions'
import { inIdOrder, toStamps } from '@lib/stamps'
import type {
  AddUserInput,
  AuthUserInput,
  Permission,
  UpdateUserInput,
  User,
  UsersService
} from '@api/system'
import type { Dependencies } from '../container'
import { permission, user } from '../db/schema'
import { hashPassword, verifyPassword } from './password'

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const byPermissionOrder = (a: Permission, b: Permission) =>
  PERMISSIONS.indexOf(a) - PERMISSIONS.indexOf(b)

/** The DTO of a user row: no password, permissions in `PERMISSIONS` order. */
const toUser = (
  { password: _password, ...u }: typeof user.$inferSelect,
  permissions: Permission[]
): User => ({
  ...u,
  permissions: [...permissions].sort(byPermissionOrder),
  ...toStamps(u)
})

export class UsersServiceImpl implements UsersService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  private get db() {
    return this.database.db
  }

  /** Users with their permissions in two queries (no N+1), in the order of `ids`; unknown ids are omitted. */
  private async load(ids: number[]): Promise<User[]> {
    const { db } = this
    const [rows, perms] = await Promise.all([
      db.select().from(user).where(inArray(user.id, ids)),
      db.select().from(permission).where(inArray(permission.userId, ids))
    ])

    const byUser = new Map<number, Permission[]>()
    perms.forEach(p =>
      byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p.name])
    )

    return inIdOrder(ids, rows).map(u => toUser(u, byUser.get(u.id) ?? []))
  }

  private async loadOne(id: number) {
    const [found] = await this.load([id])
    if (!found) throw notFound('User', String(id))

    return found
  }

  get = (id: number) => this.loadOne(id)

  getMany = (ids: number[]) => this.load([...new Set(ids)])

  async auth({ email, password }: AuthUserInput) {
    const [row] = await this.db
      .select()
      .from(user)
      .where(and(eq(user.email, normalizeEmail(email)), isNull(user.deletedAt)))
    if (!row || !verifyPassword(password, row.password))
      throw unauthorized('Invalid credentials')

    const perms = await this.db
      .select({ name: permission.name })
      .from(permission)
      .where(eq(permission.userId, row.id))

    return toUser(
      row,
      perms.map(p => p.name)
    )
  }

  async add({ email, name, password, permissions }: AddUserInput) {
    try {
      const added = await this.database.withTransaction(async tx => {
        const [row] = await tx
          .insert(user)
          .values({
            email: normalizeEmail(email),
            name,
            password: hashPassword(password)
          })
          .returning()
        if (!row) throw new Error('insert returned no row')

        const unique = [...new Set(permissions)]

        if (unique.length)
          await tx
            .insert(permission)
            .values(unique.map(name => ({ userId: row.id, name })))

        return toUser(row, unique)
      })

      this.log.info({ targetUserId: added.id }, 'user added')
      return added
    } catch (err) {
      throw isUniqueViolation(err) ? conflict('Email already registered') : err
    }
  }

  async update({ id, name, permissions, password }: UpdateUserInput) {
    await this.database.withTransaction(async tx => {
      const [row] = await tx
        .update(user)
        .set({
          updatedAt: new Date(), // also when only the permissions change
          ...(name && { name }),
          ...(password && { password: hashPassword(password) })
        })
        .where(and(eq(user.id, id), isNull(user.deletedAt)))
        .returning({ id: user.id })
      if (!row) throw notFound('User', String(id))

      if (permissions) {
        const unique = [...new Set(permissions)]

        await tx
          .delete(permission)
          .where(
            and(
              eq(permission.userId, id),
              unique.length ? notInArray(permission.name, unique) : undefined
            )
          )

        if (unique.length)
          await tx
            .insert(permission)
            .values(unique.map(name => ({ userId: id, name })))
            .onConflictDoNothing()
      }
    })

    this.log.info({ targetUserId: id }, 'user updated')
    return this.loadOne(id)
  }

  async delete(id: number) {
    const [row] = await this.db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(and(eq(user.id, id), isNull(user.deletedAt)))
      .returning({ id: user.id })

    if (!row) {
      const [existing] = await this.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, id))

      if (!existing) throw notFound('User', String(id)) // already deleted is fine (idempotent)
    }

    this.log.info({ targetUserId: id }, 'user deleted')
    return { id }
  }
}
