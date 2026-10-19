import { afterAll, describe, expect, it } from 'vitest'
import { silentLogger, testBaseConfig } from '@lib/testing'
import { unsignedJwt } from '@lib/trpc'
import type { Config } from '../config'
import { buildContainer } from '../container'
import { OrderDetailsServiceImpl } from '../services/orderDetails'
import { OrdersServiceImpl } from '../services/orders'
import { createContext } from './context'

// the pg pool and the clients are created lazily, so nothing connects here
const container = buildContainer(
  testBaseConfig('order-service', 'postgres://x:x@localhost:1/x') as Config,
  silentLogger
)

const context = createContext(container)

describe('createContext', () => {
  afterAll(() => container.dispose())

  it('exposes exactly the orders and orderDetails services', () => {
    const { services } = context({})

    expect(Object.keys(services).sort()).toEqual(['orderDetails', 'orders'])
    expect(services.orders).toBeInstanceOf(OrdersServiceImpl)
    expect(services.orderDetails).toBeInstanceOf(OrderDetailsServiceImpl)
  })

  it('takes a valid x-trace-id and appends itself to the call chain', () => {
    const ctx = context({
      'x-trace-id': 'trace-12345678',
      'x-call-chain': 'web'
    })

    expect(ctx.traceId).toBe('trace-12345678')
    expect(ctx.callChain).toEqual(['web', 'order-service'])
  })

  it('generates a trace id when the incoming one is missing or malformed', () => {
    const missing = context({})
    const malformed = context({ 'x-trace-id': 'no spaces/allowed!' })

    expect(missing.traceId).toMatch(/^[\w-]{8,64}$/)
    expect(malformed.traceId).toMatch(/^[\w-]{8,64}$/)
    expect(malformed.traceId).not.toBe('no spaces/allowed!')
    expect(missing.callChain).toEqual(['order-service'])
  })

  it('decodes the identity from the bearer token', () => {
    const jwt = unsignedJwt({ sub: '42', permissions: ['order.place'] })

    const ctx = context({ authorization: `Bearer ${jwt}` })

    expect(ctx.identity).toMatchObject({
      sub: '42',
      permissions: ['order.place']
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

    expect(a.services.orders).not.toBe(b.services.orders)
    expect(a.services.orderDetails).not.toBe(b.services.orderDetails)
  })
})
