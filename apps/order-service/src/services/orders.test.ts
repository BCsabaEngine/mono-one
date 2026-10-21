import { TRPCClientError } from '@trpc/client'
import { TRPCError } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'
import { silentLogger } from '@lib/testing'
import type { CallerInfo, CreateOrderInput } from '@api/order'
import type { Dependencies } from '../container'
import { OrdersServiceImpl } from './orders'

// Only the checks that run before the database are covered here; the transaction, the details and the
// event are covered by app.test.ts (real Postgres).

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

const setup = (belongs = true) => {
  const belongsTo = vi.fn(
    async (
      _input: { customerId: number; addressId: number },
      _opts: unknown
    ) => ({ belongs })
  )
  const withTransaction = vi.fn()
  const publish = vi.fn()

  const service = new OrdersServiceImpl({
    database: { withTransaction },
    log: silentLogger,
    customerClient: { addresses: { belongsTo: { query: belongsTo } } },
    publisher: { publish }
  } as unknown as Pick<
    Dependencies,
    'database' | 'log' | 'customerClient' | 'publisher'
  >)

  return { service, belongsTo, withTransaction, publish }
}

describe('OrdersServiceImpl.create (checks before the database)', () => {
  it("asks customer-service whether the address is the customer's, with the caller context", async () => {
    const { service, belongsTo } = setup()

    // the fake transaction returns nothing, so create fails after the checks passed
    await service.create(input, caller).catch(() => undefined)

    expect(belongsTo).toHaveBeenCalledOnce()
    expect(belongsTo).toHaveBeenCalledWith(
      { customerId: 7, addressId: 3 },
      { context: caller }
    )
  })

  it('opens the transaction once the customer and the address check out', async () => {
    const { service, withTransaction } = setup()

    await service.create(input, caller).catch(() => undefined)

    expect(withTransaction).toHaveBeenCalledOnce()
  })

  it('answers NOT_FOUND when customer-service does not know the customer', async () => {
    const { service, belongsTo, withTransaction, publish } = setup()
    belongsTo.mockRejectedValueOnce(clientError('NOT_FOUND'))

    await expect(service.create(input, caller)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Customer 7 not found'
    })
    expect(withTransaction).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('answers BAD_REQUEST when the delivery address is not one of the customer', async () => {
    const { service, withTransaction, publish } = setup(false)

    await expect(service.create(input, caller)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Address 3 is not an address of customer 7'
    })
    expect(withTransaction).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it.each(['FORBIDDEN', 'UNAUTHORIZED', 'INTERNAL_SERVER_ERROR'])(
    'keeps the downstream code %s',
    async code => {
      const { service, belongsTo, withTransaction } = setup()
      belongsTo.mockRejectedValueOnce(clientError(code))

      const error = await service.create(input, caller).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TRPCError)
      expect(error).toMatchObject({ code, message: 'downstream says no' })
      expect(withTransaction).not.toHaveBeenCalled()
    }
  )

  it('rethrows a network failure as it is', async () => {
    const { service, belongsTo, withTransaction } = setup()
    const error = new Error('connect ECONNREFUSED')
    belongsTo.mockRejectedValueOnce(error)

    await expect(service.create(input, caller)).rejects.toBe(error)
    expect(withTransaction).not.toHaveBeenCalled()
  })
})
