import { describe, expect, it, vi } from 'vitest'
import { conflict, notFound, unauthorized } from '@lib/errors'
import { silentLogger } from '@lib/testing'
import { appRouter } from '@api/system'
import type { SystemContext } from '@api/system'

const userDto = {
  id: 1,
  email: 'hello@mono.hu',
  name: 'Hello',
  permissions: ['user.admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null
}

const makeServices = () => ({
  users: {
    get: vi.fn(async () => userDto),
    getMany: vi.fn(async () => [userDto]),
    auth: vi.fn(async () => userDto),
    add: vi.fn(async () => userDto),
    update: vi.fn(async () => userDto),
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
    callChain: ['system-service'],
    ...(permissions && { identity: { sub: '1', roles: [], permissions } }),
    services: services as unknown as SystemContext['services']
  })

type Caller = ReturnType<typeof callerFor>

const adminCalls: [
  string,
  (c: Caller) => Promise<unknown>,
  (s: Services) => unknown
][] = [
  [
    'users.add',
    c => c.users.add({ email: 'a@b.hu', name: 'A', password: 'secret' }),
    s => s.users.add
  ],
  [
    'users.update',
    c => c.users.update({ id: 1, name: 'B' }),
    s => s.users.update
  ],
  ['users.delete', c => c.users.delete({ id: 1 }), s => s.users.delete]
]

const readCalls: [
  string,
  (c: Caller) => Promise<unknown>,
  (s: Services) => unknown
][] = [
  ['users.get', c => c.users.get({ id: 1 }), s => s.users.get],
  ['users.getMany', c => c.users.getMany({ ids: [1] }), s => s.users.getMany]
]

describe('system router', () => {
  describe('authorization', () => {
    it.each([...readCalls, ...adminCalls])(
      '%s without identity is UNAUTHORIZED',
      async (_, call, spy) => {
        const services = makeServices()

        await expect(call(callerFor(services))).rejects.toMatchObject({
          code: 'UNAUTHORIZED'
        })
        expect(spy(services)).not.toHaveBeenCalled()
      }
    )

    it.each(readCalls)(
      '%s needs an identity but no permission',
      async (_, call, spy) => {
        const services = makeServices()

        await call(callerFor(services, []))

        expect(spy(services)).toHaveBeenCalledOnce()
      }
    )

    it.each(adminCalls)(
      '%s without user.admin is FORBIDDEN',
      async (_, call, spy) => {
        const services = makeServices()

        await expect(
          call(callerFor(services, ['customer.admin', 'document.read']))
        ).rejects.toMatchObject({ code: 'FORBIDDEN' })
        expect(spy(services)).not.toHaveBeenCalled()
      }
    )

    it.each(adminCalls)(
      '%s with user.admin calls the service once',
      async (_, call, spy) => {
        const services = makeServices()

        await call(callerFor(services, ['user.admin']))

        expect(spy(services)).toHaveBeenCalledOnce()
      }
    )

    it('users.auth (the login) works without an identity', async () => {
      const services = makeServices()

      await expect(
        callerFor(services).users.auth({ email: 'a@b.hu', password: 'secret' })
      ).resolves.toEqual(userDto)
    })
  })

  describe('delegation', () => {
    it('passes ids as they are and the parsed input to auth, add and update', async () => {
      const services = makeServices()
      const caller = callerFor(services, ['user.admin'])

      await caller.users.get({ id: 4 })
      await caller.users.getMany({ ids: [3, 1, 3] })
      await caller.users.delete({ id: 5 })
      await caller.users.auth({ email: 'a@b.hu', password: 'secret' })
      await caller.users.add({ email: 'a@b.hu', name: 'A', password: 'secret' })
      await caller.users.update({ id: 2, permissions: [] })

      expect(services.users.get).toHaveBeenCalledWith(4)
      expect(services.users.getMany).toHaveBeenCalledWith([3, 1, 3])
      expect(services.users.delete).toHaveBeenCalledWith(5)
      expect(services.users.auth).toHaveBeenCalledWith({
        email: 'a@b.hu',
        password: 'secret'
      })
      expect(services.users.add).toHaveBeenCalledWith({
        email: 'a@b.hu',
        name: 'A',
        password: 'secret',
        permissions: []
      })
      expect(services.users.update).toHaveBeenCalledWith({
        id: 2,
        permissions: []
      })
    })

    it('returns what the service returned', async () => {
      const services = makeServices()
      const caller = callerFor(services, ['user.admin'])

      await expect(caller.users.get({ id: 1 })).resolves.toEqual(userDto)
      await expect(caller.users.getMany({ ids: [1] })).resolves.toEqual([
        userDto
      ])
      await expect(caller.users.delete({ id: 1 })).resolves.toEqual({ id: 1 })
    })
  })

  describe('input validation', () => {
    it.each([
      ['users.get with id 0', (c: Caller) => c.users.get({ id: 0 })],
      [
        'users.getMany with no ids',
        (c: Caller) => c.users.getMany({ ids: [] })
      ],
      [
        'users.auth with a bad email',
        (c: Caller) => c.users.auth({ email: 'nope', password: 'x' })
      ],
      [
        'users.auth with an empty password',
        (c: Caller) => c.users.auth({ email: 'a@b.hu', password: '' })
      ],
      [
        'users.add with an unknown permission',
        (c: Caller) =>
          c.users.add({
            email: 'a@b.hu',
            name: 'A',
            password: 'x',
            permissions: ['root' as never]
          })
      ],
      [
        'users.update with an empty name',
        (c: Caller) => c.users.update({ id: 1, name: '' })
      ]
    ])('%s is BAD_REQUEST and does not reach the service', async (_, call) => {
      const services = makeServices()

      await expect(
        call(callerFor(services, ['user.admin']))
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

      Object.values(services.users).forEach(fn =>
        expect(fn).not.toHaveBeenCalled()
      )
    })
  })

  describe('output', () => {
    it('strips a password that a service leaks', async () => {
      const services = makeServices()
      services.users.get.mockResolvedValueOnce({
        ...userDto,
        password: 'abc123'
      } as never)

      const result = await callerFor(services, []).users.get({ id: 1 })

      expect(result).not.toHaveProperty('password')
    })

    it('rejects a service result that does not match the schema', async () => {
      const services = makeServices()
      services.users.get.mockResolvedValueOnce({
        ...userDto,
        email: 'nope'
      })

      await expect(
        callerFor(services, []).users.get({ id: 1 })
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
    })
  })

  describe('errors', () => {
    it('maps domain errors to their tRPC codes', async () => {
      const services = makeServices()
      services.users.get.mockRejectedValueOnce(notFound('User', '9'))
      services.users.add.mockRejectedValueOnce(
        conflict('Email already registered')
      )
      services.users.auth.mockRejectedValueOnce(
        unauthorized('Invalid credentials')
      )

      await expect(
        callerFor(services, []).users.get({ id: 9 })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User 9 not found'
      })
      await expect(
        callerFor(services, ['user.admin']).users.add({
          email: 'a@b.hu',
          name: 'A',
          password: 'x'
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(
        callerFor(services).users.auth({ email: 'a@b.hu', password: 'x' })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials'
      })
    })

    it('masks an unknown error as INTERNAL_SERVER_ERROR', async () => {
      const services = makeServices()
      services.users.get.mockRejectedValueOnce(
        new Error('relation "user" does not exist')
      )

      await expect(
        callerFor(services, []).users.get({ id: 1 })
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal error'
      })
    })
  })
})
