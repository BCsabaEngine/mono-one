import { and, eq, inArray, isNull } from 'drizzle-orm'
import { conflict, isUniqueViolation, notFound } from '@lib/errors'
import { inIdOrder, toStamps } from '@lib/stamps'
import type {
  AddCustomerInput,
  Customer,
  CustomersService,
  CustomerSummaryInput,
  UpdateCustomerInput
} from '@api/customer'
import type { Dependencies } from '../container'
import { address, contact, customer } from '../db/schema'
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
  private async load(ids: number[]): Promise<Customer[]> {
    const { db } = this
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

  private async loadOne(id: number) {
    const [found] = await this.load([id])
    if (!found) throw notFound('Customer', String(id))

    return found
  }

  get = (id: number) => {
    this.log.debug({ customerId: id }, 'customer loading')
    return this.loadOne(id)
  }

  list = (ids: number[]) => this.load([...new Set(ids)])

  async summary({ id, addressId }: CustomerSummaryInput) {
    const [row] = await this.db
      .select({
        id: customer.id,
        code: customer.code,
        name: customer.name,
        address
      })
      .from(customer)
      .leftJoin(
        address,
        and(
          eq(address.id, addressId),
          eq(address.customerId, customer.id),
          isNull(address.deletedAt)
        )
      )
      .where(eq(customer.id, id))
    if (!row) throw notFound('Customer', String(id))

    return { ...row, address: row.address && toAddress(row.address) }
  }

  async add({ code, name, comment }: AddCustomerInput) {
    const [row] = await this.db
      .insert(customer)
      .values({ code, name, comment })
      .returning()
      .catch(duplicateCode)

    this.log.info({ customerId: row!.id }, 'customer added')
    return { ...row!, ...toStamps(row!), addresses: [], contacts: [] }
  }

  async update({ id, ...patch }: UpdateCustomerInput) {
    const [row] = await this.db
      .update(customer)
      .set({ updatedAt: new Date(), ...patch })
      .where(and(eq(customer.id, id), isNull(customer.deletedAt)))
      .returning({ id: customer.id })
      .catch(duplicateCode)
    if (!row) throw notFound('Customer', String(id))

    this.log.info({ customerId: id }, 'customer updated')
    return this.loadOne(id)
  }

  async delete(id: number) {
    const [row] = await this.db
      .update(customer)
      .set({ deletedAt: new Date() })
      .where(and(eq(customer.id, id), isNull(customer.deletedAt)))
      .returning({ id: customer.id })

    if (!row) {
      const [existing] = await this.db
        .select({ id: customer.id })
        .from(customer)
        .where(eq(customer.id, id))

      if (!existing) throw notFound('Customer', String(id)) // already deleted is fine (idempotent)
    }

    this.log.info({ customerId: id }, 'customer deleted')
    return { id }
  }
}
