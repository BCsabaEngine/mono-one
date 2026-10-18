import { eq } from 'drizzle-orm'
import { notFound } from '@mono/shared-errors'
import type { Customer, CustomersService } from '@mono/customer-contract'
import type { Cradle } from '../container'
import { customers } from '../db/schema'

export class CustomersServiceImpl implements CustomersService {
  constructor(private readonly deps: Pick<Cradle, 'database' | 'log'>) {}

  async get(id: string): Promise<Customer> {
    const [row] = await this.deps.database.db.select().from(customers).where(eq(customers.id, id))
    if (!row) throw notFound('Customer', id)
    this.deps.log.debug({ customerId: id }, 'customer loaded')
    return { ...row, createdAt: row.createdAt.toISOString() }
  }
}
