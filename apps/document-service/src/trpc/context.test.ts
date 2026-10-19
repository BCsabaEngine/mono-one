import { describe, expect, it } from 'vitest'
import { commonEnvSchema, loadConfig } from '@lib/config'
import { silentLogger } from '@lib/testing'
import { unsignedJwt } from '@lib/trpc'
import type { Config } from '../config'
import { buildContainer } from '../container'
import { DocumentsServiceImpl } from '../services/documents'
import { createContext } from './context'

const config = loadConfig(commonEnvSchema, {
  SERVICE_ID: 'document-service',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent'
}) as Config

const context = createContext(buildContainer(config, silentLogger))

describe('createContext', () => {
  it('exposes exactly the documents service', () => {
    const { services } = context({})

    expect(Object.keys(services)).toEqual(['documents'])
    expect(services.documents).toBeInstanceOf(DocumentsServiceImpl)
  })

  it('takes a valid x-trace-id and appends itself to the call chain', () => {
    const ctx = context({
      'x-trace-id': 'trace-12345678',
      'x-call-chain': 'web'
    })

    expect(ctx.traceId).toBe('trace-12345678')
    expect(ctx.callChain).toEqual(['web', 'document-service'])
  })

  it('generates a trace id when the incoming one is missing or malformed', () => {
    const missing = context({})
    const malformed = context({ 'x-trace-id': 'no spaces/allowed!' })

    expect(missing.traceId).toMatch(/^[\w-]{8,64}$/)
    expect(malformed.traceId).toMatch(/^[\w-]{8,64}$/)
    expect(malformed.traceId).not.toBe('no spaces/allowed!')
    expect(missing.callChain).toEqual(['document-service'])
  })

  it('decodes the identity from the bearer token', () => {
    const jwt = unsignedJwt({ sub: '42', permissions: ['document.read'] })

    const ctx = context({ authorization: `Bearer ${jwt}` })

    expect(ctx.identity).toMatchObject({
      sub: '42',
      permissions: ['document.read']
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

  it('gives every request its own service instance', () => {
    expect(context({}).services.documents).not.toBe(
      context({}).services.documents
    )
  })
})
