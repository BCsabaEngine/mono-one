import { and, eq, inArray, isNull } from 'drizzle-orm'
import { notFound } from '@lib/errors'
import type {
  AddOrderDetailInput,
  OrderDetail,
  OrderDetailsService
} from '@api/order'
import type { Dependencies } from '../container'
import { order, orderDetail } from '../db/schema'
import { toDetail } from './mappers'

export class OrderDetailsServiceImpl implements OrderDetailsService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']

  constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>) {
    this.database = database
    this.log = log
  }

  async add({ orderId, ...fields }: AddOrderDetailInput): Promise<OrderDetail> {
    const row = await this.database.withTransaction(async tx => {
      // touches the order and checks in one statement that it exists and is active
      const [parent] = await tx
        .update(order)
        .set({ updatedAt: new Date() })
        .where(and(eq(order.id, orderId), isNull(order.deletedAt)))
        .returning({ id: order.id })
      if (!parent) throw notFound('Order', String(orderId))

      const [row] = await tx
        .insert(orderDetail)
        .values({
          orderId,
          ...fields,
          netValue: fields.quantity * fields.unitPrice
        })
        .returning()

      return row!
    })

    this.log.info({ orderId, orderDetailId: row.id }, 'order detail added')
    return toDetail(row)
  }

  async delete(id: number) {
    const orderId = await this.database.withTransaction(async tx => {
      const [row] = await tx
        .delete(orderDetail)
        .where(
          and(
            eq(orderDetail.id, id),
            inArray(
              orderDetail.orderId,
              tx
                .select({ id: order.id })
                .from(order)
                .where(isNull(order.deletedAt))
            )
          )
        )
        .returning({ orderId: orderDetail.orderId })
      if (!row) throw notFound('Order detail', String(id))

      await tx
        .update(order)
        .set({ updatedAt: new Date() })
        .where(eq(order.id, row.orderId))

      return row.orderId
    })

    this.log.info({ orderId, orderDetailId: id }, 'order detail deleted')
    return { id }
  }
}
