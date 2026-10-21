import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { badRequest, notFound } from '@lib/errors'
import { toStamps } from '@lib/stamps'
import { notFoundOr } from '@lib/trpc'
import type {
  CallerInfo,
  CreateOrderInput,
  ListOrdersInput,
  Order,
  OrderDetail,
  OrdersService
} from '@api/order'
import type { Dependencies } from '../container'
import { order, orderDetail } from '../db/schema'
import { toDetail } from './mappers'

export class OrdersServiceImpl implements OrdersService {
  private readonly database: Dependencies['database']
  private readonly log: Dependencies['log']
  private readonly customerClient: Dependencies['customerClient']
  private readonly publisher: Dependencies['publisher']

  constructor({
    database,
    log,
    customerClient,
    publisher
  }: Pick<Dependencies, 'database' | 'log' | 'customerClient' | 'publisher'>) {
    this.database = database
    this.log = log
    this.customerClient = customerClient
    this.publisher = publisher
  }

  private get db() {
    return this.database.db
  }

  async create(
    { details, ...fields }: CreateOrderInput,
    caller: CallerInfo
  ): Promise<Order> {
    const { log, customerClient, publisher } = this

    // service-to-service call; the user's JWT is forwarded because customer-service authorizes on it
    const { belongs } = await customerClient.addresses.belongsTo
      .query(
        {
          customerId: fields.customerId,
          addressId: fields.deliveryAddressId
        },
        { context: { ...caller } }
      )
      .catch(notFoundOr('Customer', fields.customerId))
    if (!belongs)
      throw badRequest(
        `Address ${fields.deliveryAddressId} is not an address of customer ${fields.customerId}`
      )

    const { row, rows } = await this.database.withTransaction(async tx => {
      const [row] = await tx.insert(order).values(fields).returning()

      const rows = await tx
        .insert(orderDetail)
        .values(
          details.map(d => ({
            orderId: row!.id,
            ...d,
            netValue: d.quantity * d.unitPrice
          }))
        )
        .returning()

      return { row: row!, rows: rows.sort((a, b) => a.id - b.id) }
    })

    const created: Order = {
      ...row,
      ...toStamps(row),
      details: rows.map(toDetail)
    }

    // after the commit, best effort; failures are logged by the publisher and never fail the request
    void Promise.resolve(
      publisher.publish(
        'order.placed',
        {
          orderId: created.id,
          customerId: created.customerId,
          totalCents: rows.reduce((sum, r) => sum + r.netValue, 0)
        },
        {
          traceId: caller.traceId,
          callChain: caller.callChain,
          ...(caller.userId && { userId: caller.userId })
        }
      )
    ).catch(err => log.error({ err }, 'order.placed publish failed'))

    log.info({ orderId: created.id }, 'order created')
    return created
  }

  async get(id: number): Promise<Order> {
    const [[row], details] = await Promise.all([
      this.db
        .select()
        .from(order)
        .where(and(eq(order.id, id), isNull(order.deletedAt))),
      this.db
        .select()
        .from(orderDetail)
        .where(eq(orderDetail.orderId, id))
        .orderBy(orderDetail.id)
    ])
    if (!row) throw notFound('Order', String(id))

    return { ...row, ...toStamps(row), details: details.map(toDetail) }
  }

  async list({ customerId, limit, offset }: ListOrdersInput): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(order)
      .where(
        and(
          isNull(order.deletedAt),
          customerId === undefined
            ? undefined
            : eq(order.customerId, customerId)
        )
      )
      .orderBy(desc(order.id))
      .limit(limit)
      .offset(offset)
    if (!rows.length) return []

    const details = await this.db
      .select()
      .from(orderDetail)
      .where(
        inArray(
          orderDetail.orderId,
          rows.map(r => r.id)
        )
      )
      .orderBy(orderDetail.id)

    const byId = new Map(
      rows.map(r => [
        r.id,
        { ...r, ...toStamps(r), details: [] as OrderDetail[] }
      ])
    )

    details.forEach(d => byId.get(d.orderId)?.details.push(toDetail(d)))

    return rows.map(r => byId.get(r.id)!)
  }

  async delete(id: number) {
    const [row] = await this.db
      .update(order)
      .set({ deletedAt: new Date() })
      .where(and(eq(order.id, id), isNull(order.deletedAt)))
      .returning({ id: order.id })

    if (!row) {
      const [existing] = await this.db
        .select({ id: order.id })
        .from(order)
        .where(eq(order.id, id))

      if (!existing) throw notFound('Order', String(id)) // already deleted is fine (idempotent)
    }

    this.log.info({ orderId: id }, 'order deleted')
    return { id }
  }
}
