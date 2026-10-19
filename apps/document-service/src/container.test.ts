import { describe, expect, it } from 'vitest'
import { commonEnvSchema, loadConfig } from '@lib/config'
import { silentLogger } from '@lib/testing'
import { applyOverrides } from '@lib/trpc'
import { buildContainer } from './container'
import type { Config } from './config'
import type { Dependencies } from './container'
import { DocumentsServiceImpl } from './services/documents'

// no database; the clients are lazy, so nothing connects here
const config = loadConfig(commonEnvSchema, {
  SERVICE_ID: 'document-service',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent'
}) as Config

describe('container', () => {
  it('resolves config and log from the root', () => {
    const { cradle } = buildContainer(config, silentLogger)

    expect(cradle.config.SERVICE_ID).toBe('document-service')
    expect(cradle.log).toBe(silentLogger)
  })

  it('builds the documents service per scope', () => {
    const container = buildContainer(config, silentLogger)
    const a = container.createScope()
    const b = container.createScope()

    expect(a.cradle.documents).toBeInstanceOf(DocumentsServiceImpl)
    expect(a.cradle.documents).toBe(a.cradle.documents)
    expect(a.cradle.documents).not.toBe(b.cradle.documents)
  })

  it('shares the order and customer clients across scopes', () => {
    const container = buildContainer(config, silentLogger)
    const a = container.createScope().cradle
    const b = container.createScope().cradle

    expect(a.orderClient).toBe(b.orderClient)
    expect(a.customerClient).toBe(b.customerClient)
    expect(a.orderClient).not.toBe(a.customerClient)
  })

  it('lets applyOverrides replace a client', () => {
    const container = buildContainer(config, silentLogger)
    const fake = { orders: {} } as unknown as Dependencies['orderClient']

    applyOverrides(container, { orderClient: fake })

    expect(container.cradle.orderClient).toBe(fake)
    expect(container.createScope().cradle.orderClient).toBe(fake)
  })
})
