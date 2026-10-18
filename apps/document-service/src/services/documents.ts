import { TRPCClientError } from '@trpc/client'
import { notFound } from '@lib/errors'
import { fromClientError } from '@lib/trpc'
import type { CallContext } from '@lib/trpc'
import type { DocumentsService, GeneratedDocument } from '@api/document'
import type { Dependencies } from '../container'
import { renderOrderMarkdown } from './orderMarkdown'

export class DocumentsServiceImpl implements DocumentsService {
  private readonly log: Dependencies['log']
  private readonly orderClient: Dependencies['orderClient']
  private readonly customerClient: Dependencies['customerClient']

  constructor({
    log,
    orderClient,
    customerClient
  }: Pick<Dependencies, 'log' | 'orderClient' | 'customerClient'>) {
    this.log = log
    this.orderClient = orderClient
    this.customerClient = customerClient
  }

  async generateOrderDocument(
    orderId: number,
    caller: CallContext
  ): Promise<GeneratedDocument> {
    const context = { ...caller }

    // both services authorize on the user's JWT, which is forwarded with the trace and call chain
    const order = await this.orderClient.orders.get
      .query({ id: orderId }, { context })
      .catch(notFoundOr('Order', orderId))

    const customer = await this.customerClient.customers.get
      .query({ id: order.customerId }, { context })
      .catch(notFoundOr('Customer', order.customerId))

    this.log.info(
      { orderId, customerId: customer.id },
      'order document generated'
    )

    return {
      orderId,
      filename: `order-${orderId}.md`,
      contentType: 'text/markdown',
      content: renderOrderMarkdown(order, customer)
    }
  }
}

/** Downstream NOT_FOUND becomes this service's NOT_FOUND; other downstream errors keep their code (`fromClientError`). */
const notFoundOr =
  (what: string, id: number) =>
  (err: unknown): never => {
    if (err instanceof TRPCClientError && err.data?.code === 'NOT_FOUND')
      throw notFound(what, String(id))

    return fromClientError(err)
  }
