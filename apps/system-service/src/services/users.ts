import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { conflict, notFound, unauthorized } from '@lib/errors'
import { PERMISSIONS } from '@api/system'
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
import type * as schema from '../db/schema'
import { hashPassword, verifyPassword } from './password'

type Executor = Pick<NodePgDatabase<typeof schema>, 'select'> // the db or a transaction

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const byPermissionOrder = (a: Permission, b: Permission) =>
  PERMISSIONS.indexOf(a) - PERMISSIONS.indexOf(b)
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  ('code' in err
    ? err.code === '23505'
    : 'cause' in err && isUniqueViolation(err.cause))

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
  private async load(ids: number[], db: Executor = this.db): Promise<User[]> {
    const [rows, perms] = await Promise.all([
      db.select().from(user).where(inArray(user.id, ids)),
      db.select().from(permission).where(inArray(permission.userId, ids))
    ])
    const byId = new Map(
      rows.map(({ password: _password, ...u }) => [
        u.id,
        { ...u, permissions: [] as Permission[] }
      ])
    )
    perms.forEach(p => byId.get(p.userId)?.permissions.push(p.name))
    return ids.flatMap(id => {
      const u = byId.get(id)
      return u
        ? [
            {
              ...u,
              permissions: u.permissions.sort(byPermissionOrder),
              created: u.created.toISOString(),
              updated: u.updated.toISOString(),
              deleted: u.deleted?.toISOString() ?? null
            }
          ]
        : []
    })
  }

  private async loadOne(id: number, db?: Executor) {
    const [found] = await this.load([id], db)
    if (!found) throw notFound('User', String(id))
    return found
  }

  get = (id: number) => this.loadOne(id)

  getMany = (ids: number[]) => this.load([...new Set(ids)])

  async auth({ email, password }: AuthUserInput) {
    const [row] = await this.db
      .select({ id: user.id, password: user.password })
      .from(user)
      .where(and(eq(user.email, normalizeEmail(email)), isNull(user.deleted)))
    if (!row || !verifyPassword(password, row.password))
      throw unauthorized('Invalid credentials')
    return this.loadOne(row.id)
  }

  async add({ email, name, password, permissions }: AddUserInput) {
    try {
      const id = await this.database.withTransaction(async tx => {
        const [row] = await tx
          .insert(user)
          .values({
            email: normalizeEmail(email),
            name,
            password: hashPassword(password)
          })
          .returning({ id: user.id })
        if (!row) throw new Error('insert returned no row')
        if (permissions.length)
          await tx
            .insert(permission)
            .values(
              [...new Set(permissions)].map(name => ({ userId: row.id, name }))
            )
        return row.id
      })
      this.log.info({ targetUserId: id }, 'user added')
      return await this.loadOne(id)
    } catch (err) {
      throw isUniqueViolation(err) ? conflict('Email already registered') : err
    }
  }

  async update({ id, name, permissions, password }: UpdateUserInput) {
    return this.database.withTransaction(async tx => {
      const [existing] = await tx
        .select({ deleted: user.deleted })
        .from(user)
        .where(eq(user.id, id))
        .for('update')
      if (!existing || existing.deleted) throw notFound('User', String(id))
      await tx
        .update(user)
        .set({
          updated: new Date(),
          ...(name && { name }),
          ...(password && { password: hashPassword(password) })
        })
        .where(eq(user.id, id))
      if (permissions) {
        await tx.delete(permission).where(eq(permission.userId, id))
        if (permissions.length)
          await tx
            .insert(permission)
            .values(
              [...new Set(permissions)].map(name => ({ userId: id, name }))
            )
      }
      this.log.info({ targetUserId: id }, 'user updated')
      return this.loadOne(id, tx)
    })
  }

  async delete(id: number) {
    const [existing] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, id))
    if (!existing) throw notFound('User', String(id))
    await this.db
      .update(user)
      .set({ deleted: new Date(), updated: new Date() })
      .where(and(eq(user.id, id), isNull(user.deleted)))
    this.log.info({ targetUserId: id }, 'user deleted')
    return { id }
  }
}
