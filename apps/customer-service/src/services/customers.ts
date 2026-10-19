import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Executor } from '@lib/db'
import { conflict, isUniqueViolation, notFound } from '@lib/errors'
import { inIdOrder, toStamps } from '@lib/stamps'
import type {
  AddCustomerInput,
  Customer,
  CustomersService,
  UpdateCustomerInput
} from '@api/customer'
import type { Dependencies } from '../container'
import { address, contact, customer } from '../db/schema'
import type * as schema from '../db/schema'
import { toAddress, toContact } from './mappers'

const duplicateCode = (err: unknown): never => {
  throw isUniqueViolation(err) ? conflict('Customer code already in use') : err
}

export class CustomersServiceImpl implements CustomersService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  private get db() {
    return this.database.db
  }

  /** Customers with their active addresses and contacts in three queries (no N+1), in the order of `ids`; unknown ids are omitted. */
  private async load(
    ids: number[],
    db: Executor<typeof schema> = this.db
  ): Promise<Customer[]> {
    const [rows, addresses, contacts] = await Promise.all([
      db.select().from(customer).where(inArray(customer.id, ids)),
      db
        .select()
        .from(address)
        .where(and(inArray(address.customerId, ids), isNull(address.deletedAt)))
        .orderBy(address.id),
      db
        .select()
        .from(contact)
        .where(and(inArray(contact.customerId, ids), isNull(contact.deletedAt)))
        .orderBy(contact.id)
    ])

    const byId = new Map(
      rows.map(r => [
        r.id,
        {
          ...r,
          ...toStamps(r),
          addresses: [] as Customer['addresses'],
          contacts: [] as Customer['contacts']
        }
      ])
    )

    addresses.forEach(a => byId.get(a.customerId)?.addresses.push(toAddress(a)))
    contacts.forEach(c => byId.get(c.customerId)?.contacts.push(toContact(c)))

    return inIdOrder(ids, [...byId.values()])
  }

  private async loadOne(id: number, db?: Executor<typeof schema>) {
    const [found] = await this.load([id], db)
    if (!found) throw notFound('Customer', String(id))

    return found
  }

  get = (id: number) => {
    this.log.debug({ customerId: id }, 'customer loading')
    return this.loadOne(id)
  }

  list = (ids: number[]) => this.load([...new Set(ids)])

  async add({ code, name, comment }: AddCustomerInput) {
    const [row] = await this.db
      .insert(customer)
      .values({ code, name, comment })
      .returning({ id: customer.id })
      .catch(duplicateCode)

    this.log.info({ customerId: row!.id }, 'customer added')
    return this.loadOne(row!.id)
  }

  async update({ id, ...patch }: UpdateCustomerInput) {
    return this.database
      .withTransaction(async tx => {
        const [existing] = await tx
          .select({ deletedAt: customer.deletedAt })
          .from(customer)
          .where(eq(customer.id, id))
          .for('update')
        if (!existing || existing.deletedAt)
          throw notFound('Customer', String(id))

        await tx
          .update(customer)
          .set({ updatedAt: new Date(), ...patch })
          .where(eq(customer.id, id))

        this.log.info({ customerId: id }, 'customer updated')
        return this.loadOne(id, tx)
      })
      .catch(duplicateCode)
  }

  async delete(id: number) {
    const [existing] = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.id, id))
    if (!existing) throw notFound('Customer', String(id))

    await this.db
      .update(customer)
      .set({ deletedAt: new Date() })
      .where(and(eq(customer.id, id), isNull(customer.deletedAt)))

    this.log.info({ customerId: id }, 'customer deleted')
    return { id }
  }
}
