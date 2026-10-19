import { afterAll, describe, expect, it } from 'vitest'
import { silentLogger, testBaseConfig } from '@lib/testing'
import { buildContainer } from './container'
import type { Config } from './config'
import { AddressesServiceImpl } from './services/addresses'
import { ContactsServiceImpl } from './services/contacts'
import { CustomersServiceImpl } from './services/customers'

// the pg pool is created lazily, so nothing connects here
const container = buildContainer(
  testBaseConfig('customer-service', 'postgres://x:x@localhost:1/x') as Config,
  silentLogger
)

describe('container', () => {
  afterAll(() => container.dispose())

  it('resolves config, log and database from the root', () => {
    const { config, log, database } = container.cradle

    expect(config.SERVICE_ID).toBe('customer-service')
    expect(log).toBe(silentLogger)
    expect(database.db).toBeDefined()
  })

  it('builds the three services with the shared database', () => {
    const { customers, addresses, contacts } = container.createScope().cradle

    expect(customers).toBeInstanceOf(CustomersServiceImpl)
    expect(addresses).toBeInstanceOf(AddressesServiceImpl)
    expect(contacts).toBeInstanceOf(ContactsServiceImpl)
  })

  it('creates a new service instance per scope and one per scope otherwise', () => {
    const a = container.createScope()
    const b = container.createScope()

    expect(a.cradle.customers).toBe(a.cradle.customers)
    expect(a.cradle.customers).not.toBe(b.cradle.customers)
  })

  it('shares one database across scopes', () => {
    expect(container.createScope().cradle.database).toBe(
      container.createScope().cradle.database
    )
  })
})
