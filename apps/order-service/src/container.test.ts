import { afterAll, describe, expect, it } from 'vitest'
import { silentLogger, testBaseConfig } from '@lib/testing'
import { applyOverrides } from '@lib/trpc'
import { buildContainer } from './container'
import type { Config } from './config'
import type { Dependencies } from './container'
import { OrderDetailsServiceImpl } from './services/orderDetails'
import { OrdersServiceImpl } from './services/orders'

// the pg pool and the clients are created lazily, so nothing connects here
const container = buildContainer(
  testBaseConfig('order-service', 'postgres://x:x@localhost:1/x') as Config,
  silentLogger
)

describe('container', () => {
  afterAll(() => container.dispose())

  it('resolves config, log and database from the root', () => {
    const { config, log, database } = container.cradle

    expect(config.SERVICE_ID).toBe('order-service')
    expect(log).toBe(silentLogger)
    expect(database.db).toBeDefined()
  })

  it('builds both services per scope', () => {
    const a = container.createScope()
    const b = container.createScope()

    expect(a.cradle.orders).toBeInstanceOf(OrdersServiceImpl)
    expect(a.cradle.orderDetails).toBeInstanceOf(OrderDetailsServiceImpl)
    expect(a.cradle.orders).toBe(a.cradle.orders)
    expect(a.cradle.orders).not.toBe(b.cradle.orders)
    expect(a.cradle.orderDetails).not.toBe(b.cradle.orderDetails)
  })

  it('shares the database, the customer client and the publisher across scopes', () => {
    const a = container.createScope().cradle
    const b = container.createScope().cradle

    expect(a.database).toBe(b.database)
    expect(a.customerClient).toBe(b.customerClient)
    expect(a.publisher).toBe(b.publisher)
  })

  it('has a publisher that can publish and count failures', () => {
    const { publisher } = container.cradle

    expect(publisher.publish).toBeTypeOf('function')
    expect(publisher.failedDeliveries).toBeTypeOf('function')
  })

  it('lets applyOverrides replace the customer client and the publisher', () => {
    const own = buildContainer(
      testBaseConfig('order-service', 'postgres://x:x@localhost:1/x') as Config,
      silentLogger
    )
    const customerClient = {} as Dependencies['customerClient']
    const publisher = {} as Dependencies['publisher']

    applyOverrides(own, { customerClient, publisher })

    expect(own.cradle.customerClient).toBe(customerClient)
    expect(own.createScope().cradle.publisher).toBe(publisher)

    return own.dispose()
  })
})
