import { TRPCClientError } from '@trpc/client'
import { TRPCError } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { silentLogger } from '@lib/testing'
import type { CallContext } from '@lib/trpc'
import type { Customer } from '@api/customer'
import type { Order } from '@api/order'
import type { Dependencies } from '../container'
import { DocumentsServiceImpl } from './documents'
import { renderOrderMarkdown } from './orderMarkdown'

const stamps = {
  createdAt: '2026-10-18T08:30:00.000Z',
  updatedAt: '2026-10-18T08:30:00.000Z'
}

const order: Order = {
  id: 5,
  customerId: 7,
  title: 'Spring delivery',
  comment: null,
  deliveryAddressId: 3,
  details: [
    {
      id: 1,
      orderId: 5,
      productCode: 'P-1',
      productName: 'Widget',
      quantity: 2,
      unitPrice: 500,
      netValue: 1000,
      ...stamps
    }
  ],
  ...stamps
}

const customer: Customer = {
  id: 7,
  code: 'C-0007',
  name: 'Test Customer',
  comment: null,
  addresses: [
    {
      id: 3,
      customerId: 7,
      type: 'hq',
      name: null,
      country: 'HU',
      zip: '1051',
      city: 'Budapest',
      address: 'Fo utca 1',
      ...stamps,
      deletedAt: null
    }
  ],
  contacts: [],
  ...stamps,
  deletedAt: null
}

const caller: CallContext = {
  jwt: 'a.b.c',
  traceId: 'trace-abcdef',
  callChain: ['web'],
  userId: 'user-1'
}

const clientError = (code?: string) =>
  Object.assign(new TRPCClientError('downstream says no'), {
    data: code ? { code } : undefined
  })

const setup = () => {
  const orderGet = vi.fn(
    async (_input: { id: number }, _opts: unknown) => order
  )
  const customerGet = vi.fn(
    async (_input: { id: number }, _opts: unknown) => customer
  )
  const log = { ...silentLogger, info: vi.fn() }

  const service = new DocumentsServiceImpl({
    log,
    orderClient: { orders: { get: { query: orderGet } } },
    customerClient: { customers: { get: { query: customerGet } } }
  } as unknown as Pick<Dependencies, 'log' | 'orderClient' | 'customerClient'>)

  return { service, orderGet, customerGet, log }
}

describe('DocumentsServiceImpl.generateOrderDocument', () => {
  it('renders the order and its customer into a markdown document', async () => {
    const { service } = setup()

    const result = await service.generateOrderDocument(5, caller)

    expect(result).toEqual({
      orderId: 5,
      filename: 'order-5.md',
      contentType: 'text/markdown',
      content: renderOrderMarkdown(order, customer)
    })
  })

  it('names the file after the requested order id', async () => {
    const { service } = setup()

    const result = await service.generateOrderDocument(123456, caller)

    expect(result.filename).toBe('order-123456.md')
    expect(result.orderId).toBe(123456)
  })

  it('reads the order first, then the customer of that order, both with the caller context', async () => {
    const { service, orderGet, customerGet } = setup()

    await service.generateOrderDocument(5, caller)

    expect(orderGet).toHaveBeenCalledOnce()
    expect(orderGet).toHaveBeenCalledWith({ id: 5 }, { context: caller })
    expect(customerGet).toHaveBeenCalledOnce()
    expect(customerGet).toHaveBeenCalledWith({ id: 7 }, { context: caller })
    expect(orderGet.mock.invocationCallOrder[0]).toBeLessThan(
      customerGet.mock.invocationCallOrder[0]!
    )
  })

  it('forwards a copy of the caller, not the object itself', async () => {
    const { service, orderGet } = setup()

    await service.generateOrderDocument(5, caller)

    const { context } = orderGet.mock.calls[0]![1] as { context: CallContext }

    expect(context).toEqual(caller)
    expect(context).not.toBe(caller)
  })

  it('logs once on success', async () => {
    const { service, log } = setup()

    await service.generateOrderDocument(5, caller)

    expect(log.info).toHaveBeenCalledOnce()
    expect(log.info).toHaveBeenCalledWith(
      { orderId: 5, customerId: 7 },
      'order document generated'
    )
  })

  describe('downstream errors', () => {
    it('answers NOT_FOUND for a missing order and never asks for the customer', async () => {
      const { service, orderGet, customerGet, log } = setup()
      orderGet.mockRejectedValueOnce(clientError('NOT_FOUND'))

      await expect(
        service.generateOrderDocument(404, caller)
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Order 404 not found'
      })
      expect(customerGet).not.toHaveBeenCalled()
      expect(log.info).not.toHaveBeenCalled()
    })

    it('answers NOT_FOUND for a missing customer, naming the customer', async () => {
      const { service, customerGet, log } = setup()
      customerGet.mockRejectedValueOnce(clientError('NOT_FOUND'))

      await expect(
        service.generateOrderDocument(5, caller)
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Customer 7 not found'
      })
      expect(log.info).not.toHaveBeenCalled()
    })

    it.each([
      'FORBIDDEN',
      'UNAUTHORIZED',
      'BAD_REQUEST',
      'INTERNAL_SERVER_ERROR'
    ])('keeps the downstream code %s from either service', async code => {
      const fromOrder = setup()
      fromOrder.orderGet.mockRejectedValueOnce(clientError(code))

      const fromCustomer = setup()
      fromCustomer.customerGet.mockRejectedValueOnce(clientError(code))

      for (const { service } of [fromOrder, fromCustomer]) {
        const error = await service
          .generateOrderDocument(5, caller)
          .catch((e: unknown) => e)

        expect(error).toBeInstanceOf(TRPCError)
        expect(error).toMatchObject({
          code,
          message: 'downstream says no'
        })
      }
    })

    it('rethrows a downstream error without a code as it is', async () => {
      const { service, orderGet } = setup()
      const error = clientError()
      orderGet.mockRejectedValueOnce(error)

      await expect(service.generateOrderDocument(5, caller)).rejects.toBe(error)
    })

    it('rethrows a network failure as it is', async () => {
      const { service, customerGet } = setup()
      const error = new Error('connect ECONNREFUSED')
      customerGet.mockRejectedValueOnce(error)

      await expect(service.generateOrderDocument(5, caller)).rejects.toBe(error)
    })
  })
})
