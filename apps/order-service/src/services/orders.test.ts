import { TRPCClientError } from '@trpc/client'
import { TRPCError } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { silentLogger } from '@lib/testing'
import type { Customer } from '@api/customer'
import type { CallerInfo, CreateOrderInput } from '@api/order'
import type { Dependencies } from '../container'
import { OrdersServiceImpl } from './orders'

// Only the checks that run before the database are covered here; the transaction, the details and the
// event are covered by app.test.ts (real Postgres).

const stamps = {
  createdAt: '2026-10-18T08:30:00.000Z',
  updatedAt: '2026-10-18T08:30:00.000Z'
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

const input: CreateOrderInput = {
  customerId: 7,
  title: 'Spring delivery',
  deliveryAddressId: 3,
  details: [
    { productCode: 'P-1', productName: 'Widget', quantity: 2, unitPrice: 500 }
  ]
}

const caller: CallerInfo = {
  jwt: 'a.b.c',
  traceId: 'trace-abcdef',
  callChain: ['web'],
  userId: 'user-1'
}

const clientError = (code?: string) =>
  Object.assign(new TRPCClientError('downstream says no'), {
    data: code ? { code } : undefined
  })

const setup = (found: Customer = customer) => {
  const customerGet = vi.fn(
    async (_input: { id: number }, _opts: unknown) => found
  )
  const withTransaction = vi.fn()
  const publish = vi.fn()

  const service = new OrdersServiceImpl({
    database: { withTransaction },
    log: silentLogger,
    customerClient: { customers: { get: { query: customerGet } } },
    publisher: { publish }
  } as unknown as Pick<
    Dependencies,
    'database' | 'log' | 'customerClient' | 'publisher'
  >)

  return { service, customerGet, withTransaction, publish }
}

describe('OrdersServiceImpl.create (checks before the database)', () => {
  it('looks the customer up with the caller context', async () => {
    const { service, customerGet } = setup()

    // the fake transaction returns nothing, so create fails after the checks passed
    await service.create(input, caller).catch(() => undefined)

    expect(customerGet).toHaveBeenCalledOnce()
    expect(customerGet).toHaveBeenCalledWith({ id: 7 }, { context: caller })
  })

  it('opens the transaction once the customer and the address check out', async () => {
    const { service, withTransaction } = setup()

    await service.create(input, caller).catch(() => undefined)

    expect(withTransaction).toHaveBeenCalledOnce()
  })

  it('answers NOT_FOUND when customer-service does not know the customer', async () => {
    const { service, customerGet, withTransaction, publish } = setup()
    customerGet.mockRejectedValueOnce(clientError('NOT_FOUND'))

    await expect(service.create(input, caller)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Customer 7 not found'
    })
    expect(withTransaction).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('answers NOT_FOUND for a soft-deleted customer', async () => {
    const { service, withTransaction, publish } = setup({
      ...customer,
      deletedAt: '2026-10-19T00:00:00.000Z'
    })

    await expect(service.create(input, caller)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Customer 7 not found'
    })
    expect(withTransaction).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('answers BAD_REQUEST when the delivery address is not one of the customer', async () => {
    const { service, withTransaction, publish } = setup()

    await expect(
      service.create({ ...input, deliveryAddressId: 99 }, caller)
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Address 99 is not an address of customer 7'
    })
    expect(withTransaction).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('answers BAD_REQUEST when the customer has no addresses at all', async () => {
    const { service, withTransaction } = setup({ ...customer, addresses: [] })

    await expect(service.create(input, caller)).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    })
    expect(withTransaction).not.toHaveBeenCalled()
  })

  it.each(['FORBIDDEN', 'UNAUTHORIZED', 'INTERNAL_SERVER_ERROR'])(
    'keeps the downstream code %s',
    async code => {
      const { service, customerGet, withTransaction } = setup()
      customerGet.mockRejectedValueOnce(clientError(code))

      const error = await service.create(input, caller).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TRPCError)
      expect(error).toMatchObject({ code, message: 'downstream says no' })
      expect(withTransaction).not.toHaveBeenCalled()
    }
  )

  it('rethrows a network failure as it is', async () => {
    const { service, customerGet, withTransaction } = setup()
    const error = new Error('connect ECONNREFUSED')
    customerGet.mockRejectedValueOnce(error)

    await expect(service.create(input, caller)).rejects.toBe(error)
    expect(withTransaction).not.toHaveBeenCalled()
  })
})
