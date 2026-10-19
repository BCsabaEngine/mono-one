import { describe, expect, it, vi } from 'vitest'
import { conflict, notFound } from '@lib/errors'
import { silentLogger } from '@lib/testing'
import { appRouter } from '@api/order'
import type { OrderContext } from '@api/order'

const stamps = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const detailDto = {
  id: 1,
  orderId: 5,
  productCode: 'P-1',
  productName: 'Widget',
  quantity: 2,
  unitPrice: 500,
  netValue: 1000,
  ...stamps
}

const orderDto = {
  id: 5,
  customerId: 1,
  title: 'Spring delivery',
  comment: null,
  deliveryAddressId: 3,
  details: [detailDto],
  ...stamps
}

const createInput = {
  customerId: 1,
  title: 'Spring delivery',
  deliveryAddressId: 3,
  details: [
    { productCode: 'P-1', productName: 'Widget', quantity: 2, unitPrice: 500 }
  ]
}

const makeServices = () => ({
  orders: {
    create: vi.fn(async () => orderDto),
    get: vi.fn(async () => orderDto),
    list: vi.fn(async () => [orderDto]),
    delete: vi.fn(async () => ({ id: 5 }))
  },
  orderDetails: {
    add: vi.fn(async () => detailDto),
    delete: vi.fn(async () => ({ id: 1 }))
  }
})

type Services = ReturnType<typeof makeServices>

const callerFor = (
  services: Services,
  identity?: { permissions: string[] }, // undefined = no identity
  extra: { userId?: string; jwt?: string } = {}
) =>
  appRouter.createCaller({
    log: silentLogger,
    traceId: 'trace-0001',
    callChain: ['web', 'order-service'],
    ...extra,
    ...(identity && { identity: { sub: '1', roles: [], ...identity } }),
    services: services as unknown as OrderContext['services']
  })

type Caller = ReturnType<typeof callerFor>

const calls: [
  string,
  (c: Caller) => Promise<unknown>,
  (s: Services) => unknown
][] = [
  ['orders.create', c => c.orders.create(createInput), s => s.orders.create],
  ['orders.get', c => c.orders.get({ id: 5 }), s => s.orders.get],
  ['orders.list', c => c.orders.list({}), s => s.orders.list],
  ['orders.delete', c => c.orders.delete({ id: 5 }), s => s.orders.delete],
  [
    'orderDetails.add',
    c =>
      c.orderDetails.add({
        orderId: 5,
        productCode: 'P-1',
        productName: 'Widget',
        quantity: 2,
        unitPrice: 500
      }),
    s => s.orderDetails.add
  ],
  [
    'orderDetails.delete',
    c => c.orderDetails.delete({ id: 1 }),
    s => s.orderDetails.delete
  ]
]

describe('order router', () => {
  describe('authorization', () => {
    it.each(calls)(
      '%s without identity is UNAUTHORIZED',
      async (_, call, spy) => {
        const services = makeServices()

        await expect(call(callerFor(services))).rejects.toMatchObject({
          code: 'UNAUTHORIZED'
        })
        expect(spy(services)).not.toHaveBeenCalled()
      }
    )

    // pinned as is: the router only requires an identity, no permission (e.g. not order.place)
    it.each(calls)(
      '%s with an identity but no permission calls the service',
      async (_, call, spy) => {
        const services = makeServices()

        await call(callerFor(services, { permissions: [] }))

        expect(spy(services)).toHaveBeenCalledOnce()
      }
    )
  })

  describe('delegation', () => {
    it('passes the parsed input and the caller context to orders.create', async () => {
      const services = makeServices()
      const caller = callerFor(
        services,
        { permissions: [] },
        { userId: '1', jwt: 'a.b.c' }
      )

      await caller.orders.create({ ...createInput, title: ' Spring delivery ' })

      expect(services.orders.create).toHaveBeenCalledWith(
        { ...createInput, title: 'Spring delivery' },
        {
          traceId: 'trace-0001',
          callChain: ['web', 'order-service'],
          userId: '1',
          jwt: 'a.b.c'
        }
      )
    })

    it('leaves userId and jwt out of the caller context when there are none', async () => {
      const services = makeServices()

      await callerFor(services, { permissions: [] }).orders.create(createInput)

      expect(services.orders.create).toHaveBeenCalledWith(expect.anything(), {
        traceId: 'trace-0001',
        callChain: ['web', 'order-service']
      })
    })

    it('passes ids as they are and list the input with its defaults', async () => {
      const services = makeServices()
      const caller = callerFor(services, { permissions: [] })

      await caller.orders.get({ id: 4 })
      await caller.orders.delete({ id: 5 })
      await caller.orderDetails.delete({ id: 6 })
      await caller.orders.list({})
      await caller.orders.list({ customerId: 2, limit: 10, offset: 20 })

      expect(services.orders.get).toHaveBeenCalledWith(4)
      expect(services.orders.delete).toHaveBeenCalledWith(5)
      expect(services.orderDetails.delete).toHaveBeenCalledWith(6)
      expect(services.orders.list).toHaveBeenNthCalledWith(1, {
        limit: 50,
        offset: 0
      })
      expect(services.orders.list).toHaveBeenNthCalledWith(2, {
        customerId: 2,
        limit: 10,
        offset: 20
      })
    })

    it('returns what the service returned', async () => {
      const services = makeServices()
      const caller = callerFor(services, { permissions: [] })

      await expect(caller.orders.get({ id: 5 })).resolves.toEqual(orderDto)
      await expect(caller.orders.list({})).resolves.toEqual([orderDto])
      await expect(caller.orders.delete({ id: 5 })).resolves.toEqual({ id: 5 })
    })
  })

  describe('input validation', () => {
    it.each([
      ['orders.get with id 0', (c: Caller) => c.orders.get({ id: 0 })],
      [
        'orders.list with limit 101',
        (c: Caller) => c.orders.list({ limit: 101 })
      ],
      [
        'orders.list with a negative offset',
        (c: Caller) => c.orders.list({ offset: -1 })
      ],
      [
        'orders.create without details',
        (c: Caller) => c.orders.create({ ...createInput, details: [] })
      ],
      [
        'orders.create with a blank title',
        (c: Caller) => c.orders.create({ ...createInput, title: ' ' })
      ],
      [
        'orderDetails.add with quantity 0',
        (c: Caller) =>
          c.orderDetails.add({
            orderId: 5,
            productCode: 'P',
            productName: 'N',
            quantity: 0,
            unitPrice: 1
          })
      ]
    ])('%s is BAD_REQUEST and does not reach the service', async (_, call) => {
      const services = makeServices()

      await expect(
        call(callerFor(services, { permissions: [] }))
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST'
      })

      Object.values(services).forEach(group =>
        Object.values(group).forEach(fn => expect(fn).not.toHaveBeenCalled())
      )
    })
  })

  describe('output', () => {
    it('strips fields that are not part of the order', async () => {
      const services = makeServices()
      services.orders.get.mockResolvedValueOnce({
        ...orderDto,
        deletedAt: null
      } as never)

      const result = await callerFor(services, { permissions: [] }).orders.get({
        id: 5
      })

      expect(result).not.toHaveProperty('deletedAt')
    })

    it('rejects a service result that does not match the schema', async () => {
      const services = makeServices()
      services.orders.get.mockResolvedValueOnce({
        ...orderDto,
        createdAt: 'yesterday'
      })

      await expect(
        callerFor(services, { permissions: [] }).orders.get({ id: 5 })
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
    })
  })

  describe('errors', () => {
    it('maps domain errors to their tRPC codes', async () => {
      const services = makeServices()
      services.orders.get.mockRejectedValueOnce(notFound('Order', '9'))
      services.orders.delete.mockRejectedValueOnce(conflict('busy'))
      const caller = callerFor(services, { permissions: [] })

      await expect(caller.orders.get({ id: 9 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Order 9 not found'
      })
      await expect(caller.orders.delete({ id: 9 })).rejects.toMatchObject({
        code: 'CONFLICT'
      })
    })

    it('masks an unknown error as INTERNAL_SERVER_ERROR', async () => {
      const services = makeServices()
      services.orders.get.mockRejectedValueOnce(new Error('deadlock detected'))

      await expect(
        callerFor(services, { permissions: [] }).orders.get({ id: 5 })
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal error'
      })
    })
  })
})
