import { eq } from 'drizzle-orm'
import { notFound } from '@lib/errors'
import type { Document, DocumentsService } from '@api/document'
import type { Dependencies } from '../container'
import { documents } from '../db/schema'

export class DocumentsServiceImpl implements DocumentsService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  async getByOrder(orderId: string): Promise<Document> {
    const [row] = await this.database.db
      .select()
      .from(documents)
      .where(eq(documents.orderId, orderId))
    if (!row) throw notFound('Document for order', orderId)

    return { ...row, createdAt: row.createdAt.toISOString() }
  }

  /** Idempotent: a repeated order.placed event for the same order is a no-op. */
  async createForOrder(orderId: string) {
    await this.database.db
      .insert(documents)
      .values({ orderId })
      .onConflictDoNothing()

    this.log.info({ orderId }, 'order confirmation document generated')
  }
}
