import { and, eq, isNull } from 'drizzle-orm'
import { notFound } from '@lib/errors'
import type {
  AddAddressInput,
  AddressBelongsInput,
  AddressesService,
  UpdateAddressInput
} from '@api/customer'
import type { Dependencies } from '../container'
import { address, customer } from '../db/schema'
import { toAddress } from './mappers'

export class AddressesServiceImpl implements AddressesService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  private get db() {
    return this.database.db
  }

  async belongsTo({ customerId, addressId }: AddressBelongsInput) {
    const [row] = await this.db
      .select({ addressId: address.id })
      .from(customer)
      .leftJoin(
        address,
        and(
          eq(address.id, addressId),
          eq(address.customerId, customer.id),
          isNull(address.deletedAt)
        )
      )
      .where(and(eq(customer.id, customerId), isNull(customer.deletedAt)))
    if (!row) throw notFound('Customer', String(customerId))

    return { belongs: row.addressId !== null }
  }

  async add(input: AddAddressInput) {
    const [parent] = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.id, input.customerId), isNull(customer.deletedAt)))
    if (!parent) throw notFound('Customer', String(input.customerId))

    const [row] = await this.db.insert(address).values(input).returning()

    this.log.info(
      { customerId: input.customerId, addressId: row!.id },
      'address added'
    )
    return toAddress(row!)
  }

  async update({ id, ...patch }: UpdateAddressInput) {
    const [row] = await this.db
      .update(address)
      .set({ updatedAt: new Date(), ...patch })
      .where(and(eq(address.id, id), isNull(address.deletedAt)))
      .returning()
    if (!row) throw notFound('Address', String(id))

    this.log.info({ addressId: id }, 'address updated')
    return toAddress(row)
  }

  async delete(id: number) {
    const [row] = await this.db
      .update(address)
      .set({ deletedAt: new Date() })
      .where(and(eq(address.id, id), isNull(address.deletedAt)))
      .returning({ id: address.id })

    if (!row) {
      const [existing] = await this.db
        .select({ id: address.id })
        .from(address)
        .where(eq(address.id, id))

      if (!existing) throw notFound('Address', String(id)) // already deleted is fine (idempotent)
    }

    this.log.info({ addressId: id }, 'address deleted')
    return { id }
  }
}
