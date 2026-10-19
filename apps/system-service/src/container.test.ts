import { afterAll, describe, expect, it } from 'vitest'
import { silentLogger, testBaseConfig } from '@lib/testing'
import { buildContainer } from './container'
import type { Config } from './config'
import { UsersServiceImpl } from './services/users'

// the pg pool is created lazily, so nothing connects here
const container = buildContainer(
  testBaseConfig('system-service', 'postgres://x:x@localhost:1/x') as Config,
  silentLogger
)

describe('container', () => {
  afterAll(() => container.dispose())

  it('resolves config, log and database from the root', () => {
    const { config, log, database } = container.cradle

    expect(config.SERVICE_ID).toBe('system-service')
    expect(log).toBe(silentLogger)
    expect(database.db).toBeDefined()
  })

  it('builds the users service', () => {
    expect(container.createScope().cradle.users).toBeInstanceOf(
      UsersServiceImpl
    )
  })

  it('creates one users service per scope', () => {
    const a = container.createScope()
    const b = container.createScope()

    expect(a.cradle.users).toBe(a.cradle.users)
    expect(a.cradle.users).not.toBe(b.cradle.users)
  })

  it('shares one database across scopes', () => {
    expect(container.createScope().cradle.database).toBe(
      container.createScope().cradle.database
    )
  })
})
