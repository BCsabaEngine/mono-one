import { eq } from 'drizzle-orm'
import { notFound } from '@lib/errors'
import type { Customer, CustomersService } from '@api/customer'
import type { Dependencies } from '../container'
import { customers } from '../db/schema'

export class CustomersServiceImpl implements CustomersService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  async get(id: string): Promise<Customer> {
    const [row] = await this.database.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
    if (!row) throw notFound('Customer', id)
    this.log.debug({ customerId: id }, 'customer loaded')
    return { ...row, createdAt: row.createdAt.toISOString() }
  }
}
