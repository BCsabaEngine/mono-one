import { randomUUID } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import { z } from 'zod'
import { forbidden, unauthorized } from '../errors'
import type { Logger } from '../logging'
import { withTrace } from '../logging'

export const TRACE_ID_HEADER = 'x-trace-id'
export const CALL_CHAIN_HEADER = 'x-call-chain'
export const SERVICE_ID_HEADER = 'x-service-id'

/** Claims used for authorization only. The token is decoded, NOT verified (trusted internal network, see CLAUDE.md "Auth"). */
export const identitySchema = z.looseObject({
  sub: z.string(),
  roles: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([])
})
export type Identity = z.infer<typeof identitySchema>

export const decodeJwt = (jwt: string): Identity | undefined => {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString()
    )
    return identitySchema.parse(payload)
  } catch {
    return undefined
  }
}

/** Unsigned JWT for the web login and tests; core services do not verify tokens (see CLAUDE.md "Auth"). */
export const unsignedJwt = (
  claims: Identity | { sub: string; roles?: string[]; permissions?: string[] }
) =>
  ['{"alg":"none","typ":"JWT"}', JSON.stringify(claims)]
    .map(p => Buffer.from(p).toString('base64url'))
    .join('.') + '.'

export interface BaseContext {
  log: Logger
  /** Correlates every log line of one user action across services; taken from the caller or generated. */
  traceId: string
  /** Services the request passed through, caller first, this service last. */
  callChain: string[]
  /** Caller's user (JWT `sub`), when there is an identity. */
  userId?: string
  serviceId?: string
  /** Raw bearer token, forwarded to other services only when they need the user's identity. */
  jwt?: string
  identity?: Identity
}

const header = (h: IncomingHttpHeaders | Headers, name: string) => {
  const v = h instanceof Headers ? h.get(name) : h[name]
  return (Array.isArray(v) ? v[0] : v) ?? undefined
}

const TRACE_ID = /^[\w-]{8,64}$/
const CHAIN_ENTRY = /^[\w-]{1,64}$/
const MAX_CHAIN = 16

/**
 * `selfServiceId` is appended to the incoming chain; an absent or malformed trace id is replaced by a new one.
 * `jwtOverride` replaces the bearer token for callers that hold it elsewhere (web: the session in Redis).
 */
export const baseContextFromHeaders = (
  headers: IncomingHttpHeaders | Headers,
  log: Logger,
  selfServiceId: string,
  jwtOverride?: string
): BaseContext => {
  const incoming = header(headers, TRACE_ID_HEADER)
  const traceId = incoming && TRACE_ID.test(incoming) ? incoming : randomUUID()
  const callChain = [
    ...(header(headers, CALL_CHAIN_HEADER)
      ?.split(',')
      .map(s => s.trim())
      .filter(s => CHAIN_ENTRY.test(s)) ?? []),
    selfServiceId
  ].slice(-MAX_CHAIN)
  const jwt =
    jwtOverride ?? header(headers, 'authorization')?.replace(/^Bearer\s+/i, '')
  const identity = jwt ? decodeJwt(jwt) : undefined
  const serviceId = header(headers, SERVICE_ID_HEADER)
  return {
    log: withTrace(log, { traceId, callChain, userId: identity?.sub }),
    traceId,
    callChain,
    ...(identity && { userId: identity.sub }),
    ...(serviceId && { serviceId }),
    ...(jwt && { jwt }),
    ...(identity && { identity })
  }
}

export const requireIdentity = (ctx: BaseContext): Identity =>
  ctx.identity ??
  (() => {
    throw unauthorized('Missing identity')
  })()

export const requirePermission = (
  ctx: BaseContext,
  permission: string
): Identity => {
  const identity = requireIdentity(ctx)
  if (!identity.permissions.includes(permission))
    throw forbidden(`Missing permission ${permission}`)
  return identity
}

/** What a caller forwards on a downstream call; see `CallContext` in `client.ts`. */
export const callContextOf = (ctx: BaseContext) => ({
  traceId: ctx.traceId,
  callChain: ctx.callChain,
  ...(ctx.userId && { userId: ctx.userId }),
  ...(ctx.jwt && { jwt: ctx.jwt })
})
