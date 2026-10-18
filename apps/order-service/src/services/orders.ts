import { TRPCClientError } from '@trpc/client'
import { notFound } from '@lib/errors'
import type {
  CallerInfo,
  Order,
  OrdersService,
  PlaceOrderInput
} from '@api/order'
import type { Dependencies } from '../container'
import { orders } from '../db/schema'

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

  async place(input: PlaceOrderInput, caller: CallerInfo): Promise<Order> {
    const { database, log, customerClient, publisher } = this
    // service-to-service call; the user's JWT is forwarded because customer-service authorizes on it
    const customer = await customerClient.customers.get
      .query({ id: input.customerId }, { context: { ...caller } })
      .catch(err => {
        throw err instanceof TRPCClientError && err.data?.code === 'NOT_FOUND'
          ? notFound('Customer', input.customerId)
          : err
      })

    const [row] = await database.db
      .insert(orders)
      .values({
        customerId: customer.id,
        customerName: customer.name,
        totalCents: input.totalCents
      })
      .returning()
    const order: Order = { ...row!, createdAt: row!.createdAt.toISOString() }

    // after the commit, best effort; failures are logged by the publisher and never fail the request
    void publisher.publish(
      'order.placed',
      {
        orderId: order.id,
        customerId: order.customerId,
        totalCents: order.totalCents
      },
      {
        traceId: caller.traceId,
        callChain: caller.callChain,
        ...(caller.userId && { userId: caller.userId })
      }
    )
    log.info({ orderId: order.id }, 'order placed')
    return order
  }
}
