import { describe, expect, it, vi } from 'vitest'
import { conflict, notFound } from '@lib/errors'
import { silentLogger } from '@lib/testing'
import { appRouter } from '@api/customer'
import type { CustomerContext } from '@api/customer'

const stamps = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null
}

const addressDto = {
  id: 1,
  customerId: 1,
  type: 'hq',
  name: null,
  country: 'HU',
  zip: '1051',
  city: 'Budapest',
  address: 'Fo utca 1',
  ...stamps
}

const contactDto = {
  id: 1,
  customerId: 1,
  type: 'sales',
  name: 'Eva',
  phone: null,
  email: null,
  ...stamps
}

const customerDto = {
  id: 1,
  code: 'C-1',
  name: 'ACME',
  comment: null,
  addresses: [addressDto],
  contacts: [contactDto],
  ...stamps
}

const addressInput = {
  customerId: 1,
  type: 'hq',
  country: 'HU',
  zip: '1051',
  city: 'Budapest',
  address: 'Fo utca 1'
} as const

const makeServices = () => ({
  customers: {
    get: vi.fn(async () => customerDto),
    list: vi.fn(async () => [customerDto]),
    add: vi.fn(async () => customerDto),
    update: vi.fn(async () => customerDto),
    delete: vi.fn(async () => ({ id: 1 }))
  },
  addresses: {
    add: vi.fn(async () => addressDto),
    update: vi.fn(async () => addressDto),
    delete: vi.fn(async () => ({ id: 1 }))
  },
  contacts: {
    add: vi.fn(async () => contactDto),
    update: vi.fn(async () => contactDto),
    delete: vi.fn(async () => ({ id: 1 }))
  }
})

type Services = ReturnType<typeof makeServices>

const callerFor = (
  services: Services,
  permissions?: string[] // undefined = no identity
) =>
  appRouter.createCaller({
    log: silentLogger,
    traceId: 'trace-0001',
    callChain: ['customer-service'],
    ...(permissions && { identity: { sub: '1', roles: [], permissions } }),
    services: services as unknown as CustomerContext['services']
  })

type Caller = ReturnType<typeof callerFor>

// every mutation, with a valid input and the service call that must follow
const adminCalls: [
  string,
  (c: Caller) => Promise<unknown>,
  (s: Services) => unknown
][] = [
  [
    'customers.add',
    c => c.customers.add({ code: 'C-1', name: 'ACME' }),
    s => s.customers.add
  ],
  [
    'customers.update',
    c => c.customers.update({ id: 1, name: 'New' }),
    s => s.customers.update
  ],
  [
    'customers.delete',
    c => c.customers.delete({ id: 1 }),
    s => s.customers.delete
  ],
  ['addresses.add', c => c.addresses.add(addressInput), s => s.addresses.add],
  [
    'addresses.update',
    c => c.addresses.update({ id: 1, city: 'Pecs' }),
    s => s.addresses.update
  ],
  [
    'addresses.delete',
    c => c.addresses.delete({ id: 1 }),
    s => s.addresses.delete
  ],
  [
    'contacts.add',
    c => c.contacts.add({ customerId: 1, type: 'sales', name: 'Eva' }),
    s => s.contacts.add
  ],
  [
    'contacts.update',
    c => c.contacts.update({ id: 1, name: 'Anna' }),
    s => s.contacts.update
  ],
  ['contacts.delete', c => c.contacts.delete({ id: 1 }), s => s.contacts.delete]
]

describe('customer router', () => {
  describe('authorization', () => {
    it.each(adminCalls)(
      '%s without identity is UNAUTHORIZED',
      async (_, call, spy) => {
        const services = makeServices()

        await expect(call(callerFor(services))).rejects.toMatchObject({
          code: 'UNAUTHORIZED'
        })
        expect(spy(services)).not.toHaveBeenCalled()
      }
    )

    it.each(adminCalls)(
      '%s without customer.admin is FORBIDDEN',
      async (_, call, spy) => {
        const services = makeServices()

        await expect(
          call(callerFor(services, ['order.place', 'document.read']))
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
        expect(spy(services)).not.toHaveBeenCalled()
      }
    )

    it.each(adminCalls)(
      '%s with customer.admin calls the service once',
      async (_, call, spy) => {
        const services = makeServices()

        await call(callerFor(services, ['customer.admin']))

        expect(spy(services)).toHaveBeenCalledOnce()
      }
    )

    it('customers.get and customers.list need an identity but no permission', async () => {
      const services = makeServices()

      await expect(
        callerFor(services).customers.get({ id: 1 })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED'
      })
      await expect(
        callerFor(services).customers.list({ ids: [1] })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

      const caller = callerFor(services, [])

      await expect(caller.customers.get({ id: 1 })).resolves.toEqual(
        customerDto
      )
      await expect(caller.customers.list({ ids: [1] })).resolves.toEqual([
        customerDto
      ])
    })
  })

  describe('delegation', () => {
    it('passes the id of get and delete and the ids of list as they are', async () => {
      const services = makeServices()
      const caller = callerFor(services, ['customer.admin'])

      await caller.customers.get({ id: 4 })
      await caller.customers.list({ ids: [3, 1, 3] })
      await caller.customers.delete({ id: 5 })
      await caller.addresses.delete({ id: 6 })
      await caller.contacts.delete({ id: 7 })

      expect(services.customers.get).toHaveBeenCalledWith(4)
      expect(services.customers.list).toHaveBeenCalledWith([3, 1, 3])
      expect(services.customers.delete).toHaveBeenCalledWith(5)
      expect(services.addresses.delete).toHaveBeenCalledWith(6)
      expect(services.contacts.delete).toHaveBeenCalledWith(7)
    })

    it('passes the parsed (trimmed) input to add and update', async () => {
      const services = makeServices()
      const caller = callerFor(services, ['customer.admin'])

      await caller.customers.add({ code: ' C-9 ', name: ' Nine ' })
      await caller.customers.update({ id: 2, comment: null })

      expect(services.customers.add).toHaveBeenCalledWith({
        code: 'C-9',
        name: 'Nine'
      })
      expect(services.customers.update).toHaveBeenCalledWith({
        id: 2,
        comment: null
      })
    })

    it('returns what the service returned', async () => {
      const services = makeServices()
      const caller = callerFor(services, ['customer.admin'])

      await expect(caller.addresses.add(addressInput)).resolves.toEqual(
        addressDto
      )
      await expect(
        caller.contacts.add({ customerId: 1, type: 'sales', name: 'Eva' })
      ).resolves.toEqual(contactDto)
      await expect(caller.contacts.delete({ id: 1 })).resolves.toEqual({
        id: 1
      })
    })
  })

  describe('input validation', () => {
    it.each([
      ['customers.get with id 0', (c: Caller) => c.customers.get({ id: 0 })],
      [
        'customers.list with no ids',
        (c: Caller) => c.customers.list({ ids: [] })
      ],
      [
        'customers.add with a blank code',
        (c: Caller) => c.customers.add({ code: ' ', name: 'A' })
      ],
      [
        'addresses.add with a non-EU country',
        (c: Caller) =>
          c.addresses.add({ ...addressInput, country: 'US' as never })
      ],
      [
        'contacts.add with a bad email',
        (c: Caller) =>
          c.contacts.add({
            customerId: 1,
            type: 'sales',
            name: 'Eva',
            email: 'nope'
          })
      ]
    ])('%s is BAD_REQUEST and does not reach the service', async (_, call) => {
      const services = makeServices()

      await expect(
        call(callerFor(services, ['customer.admin']))
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

      Object.values(services).forEach(group =>
        Object.values(group).forEach(fn => expect(fn).not.toHaveBeenCalled())
      )
    })
  })

  describe('errors', () => {
    it('maps a DomainError NOT_FOUND from the service', async () => {
      const services = makeServices()
      services.customers.get.mockRejectedValueOnce(notFound('Customer', '9'))

      await expect(
        callerFor(services, []).customers.get({ id: 9 })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Customer 9 not found'
      })
    })

    it('maps a DomainError CONFLICT from the service', async () => {
      const services = makeServices()
      services.customers.add.mockRejectedValueOnce(
        conflict('Customer code already in use')
      )

      await expect(
        callerFor(services, ['customer.admin']).customers.add({
          code: 'C-1',
          name: 'A'
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('masks an unknown error as INTERNAL_SERVER_ERROR', async () => {
      const services = makeServices()
      services.customers.get.mockRejectedValueOnce(
        new Error('connection refused to 10.0.0.5')
      )

      await expect(
        callerFor(services, []).customers.get({ id: 1 })
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal error'
      })
    })

    it('rejects a service result that does not match the output schema', async () => {
      const services = makeServices()
      services.customers.get.mockResolvedValueOnce({
        ...customerDto,
        createdAt: 'yesterday'
      })

      await expect(
        callerFor(services, []).customers.get({ id: 1 })
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
    })
  })
})
