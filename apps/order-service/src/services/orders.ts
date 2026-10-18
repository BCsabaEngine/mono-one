import { TRPCClientError } from '@trpc/client'
import { notFound } from '@lib/errors'
import type { CallContext } from '@lib/trpc'
import type { CallerInfo, Order, OrdersService, PlaceOrderInput } from '@api/order'
import type { Cradle } from '../container'
import { orders } from '../db/schema'

export class OrdersServiceImpl implements OrdersService {
  constructor(private readonly deps: Pick<Cradle, 'database' | 'log' | 'customerClient' | 'publisher'>) {}

  async place(input: PlaceOrderInput, caller: CallerInfo): Promise<Order> {
    const { database, log, customerClient, publisher } = this.deps
    // service-to-service call; the user's JWT is forwarded because customer-service authorizes on it
    const customer = await customerClient.customers.get
      .query(
        { id: input.customerId },
        { context: { jwt: caller.jwt, requestId: caller.requestId } satisfies CallContext }
      )
      .catch(err => {
        throw err instanceof TRPCClientError && err.data?.code === 'NOT_FOUND'
          ? notFound('Customer', input.customerId)
          : err
      })

    const [row] = await database.db
      .insert(orders)
      .values({ customerId: customer.id, customerName: customer.name, totalCents: input.totalCents })
      .returning()
    const order: Order = { ...row!, createdAt: row!.createdAt.toISOString() }

    // after the commit, best effort; failures are logged by the publisher and never fail the request
    void publisher.publish(
      'order.placed',
      { orderId: order.id, customerId: order.customerId, totalCents: order.totalCents },
      { requestId: caller.requestId }
    )
    log.info({ orderId: order.id }, 'order placed')
    return order
  }
}
