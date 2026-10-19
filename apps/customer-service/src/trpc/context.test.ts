import { afterAll, describe, expect, it } from 'vitest'
import { silentLogger, testBaseConfig } from '@lib/testing'
import { unsignedJwt } from '@lib/trpc'
import type { Config } from '../config'
import { buildContainer } from '../container'
import { AddressesServiceImpl } from '../services/addresses'
import { ContactsServiceImpl } from '../services/contacts'
import { CustomersServiceImpl } from '../services/customers'
import { createContext } from './context'

// the pg pool is created lazily, so nothing connects here
const container = buildContainer(
  testBaseConfig('customer-service', 'postgres://x:x@localhost:1/x') as Config,
  silentLogger
)

const context = createContext(container)

describe('createContext', () => {
  afterAll(() => container.dispose())

  it('exposes exactly the three services', () => {
    const { services } = context({})

    expect(Object.keys(services).sort()).toEqual([
      'addresses',
      'contacts',
      'customers'
    ])
    expect(services.customers).toBeInstanceOf(CustomersServiceImpl)
    expect(services.addresses).toBeInstanceOf(AddressesServiceImpl)
    expect(services.contacts).toBeInstanceOf(ContactsServiceImpl)
  })

  it('takes a valid x-trace-id and appends itself to the call chain', () => {
    const ctx = context({
      'x-trace-id': 'trace-12345678',
      'x-call-chain': 'web,order-service'
    })

    expect(ctx.traceId).toBe('trace-12345678')
    expect(ctx.callChain).toEqual(['web', 'order-service', 'customer-service'])
  })

  it('generates a trace id when the incoming one is missing or malformed', () => {
    const missing = context({})
    const malformed = context({ 'x-trace-id': 'no spaces/allowed!' })

    expect(missing.traceId).toMatch(/^[\w-]{8,64}$/)
    expect(malformed.traceId).toMatch(/^[\w-]{8,64}$/)
    expect(malformed.traceId).not.toBe('no spaces/allowed!')
    expect(missing.callChain).toEqual(['customer-service'])
  })

  it('decodes the identity from the bearer token', () => {
    const jwt = unsignedJwt({ sub: '42', permissions: ['customer.admin'] })

    const ctx = context({ authorization: `Bearer ${jwt}` })

    expect(ctx.identity).toMatchObject({
      sub: '42',
      permissions: ['customer.admin']
    })
    expect(ctx.userId).toBe('42')
    expect(ctx.jwt).toBe(jwt)
  })

  it('has no identity without a token or with a garbage one', () => {
    expect(context({}).identity).toBeUndefined()
    expect(
      context({ authorization: 'Bearer garbage' }).identity
    ).toBeUndefined()
  })

  it('gives every request its own service instances', () => {
    const a = context({})
    const b = context({})

    expect(a.services.customers).not.toBe(b.services.customers)
  })
})
