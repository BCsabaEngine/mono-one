import { and, eq, isNull } from 'drizzle-orm'
import { notFound } from '@lib/errors'
import type {
  AddContactInput,
  ContactsService,
  UpdateContactInput
} from '@api/customer'
import type { Dependencies } from '../container'
import { contact, customer } from '../db/schema'
import { toContact } from './mappers'

export class ContactsServiceImpl implements ContactsService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  private get db() {
    return this.database.db
  }

  async add(input: AddContactInput) {
    const [parent] = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.id, input.customerId), isNull(customer.deletedAt)))
    if (!parent) throw notFound('Customer', String(input.customerId))

    const [row] = await this.db.insert(contact).values(input).returning()

    this.log.info(
      { customerId: input.customerId, contactId: row!.id },
      'contact added'
    )
    return toContact(row!)
  }

  async update({ id, ...patch }: UpdateContactInput) {
    const [row] = await this.db
      .update(contact)
      .set({ updatedAt: new Date(), ...patch })
      .where(and(eq(contact.id, id), isNull(contact.deletedAt)))
      .returning()
    if (!row) throw notFound('Contact', String(id))

    this.log.info({ contactId: id }, 'contact updated')
    return toContact(row)
  }

  async delete(id: number) {
    const [row] = await this.db
      .update(contact)
      .set({ deletedAt: new Date() })
      .where(and(eq(contact.id, id), isNull(contact.deletedAt)))
      .returning({ id: contact.id })

    if (!row) {
      const [existing] = await this.db
        .select({ id: contact.id })
        .from(contact)
        .where(eq(contact.id, id))

      if (!existing) throw notFound('Contact', String(id)) // already deleted is fine (idempotent)
    }

    this.log.info({ contactId: id }, 'contact deleted')
    return { id }
  }
}
