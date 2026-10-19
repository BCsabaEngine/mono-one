import { randomUUID } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import { z } from 'zod'
import {
  AUTHORIZATION_HEADER,
  BEARER_PREFIX,
  CALL_CHAIN_ENTRY_PATTERN,
  CALL_CHAIN_HEADER,
  MAX_CALL_CHAIN,
  SERVICE_ID_HEADER,
  TRACE_ID_HEADER,
  TRACE_ID_PATTERN
} from '../constants'
import { forbidden, unauthorized } from '../errors'
import type { Logger } from '../logging'
import { withTrace } from '../logging'
import type { PermissionName } from '../permissions'

const UNSIGNED_JWT_HEADER = '{"alg":"none","typ":"JWT"}'

/** Claims used for authorization only. The token is decoded, NOT verified (trusted internal network, see CLAUDE.md "Auth"). */
export { CALL_CHAIN_HEADER, SERVICE_ID_HEADER, TRACE_ID_HEADER }

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
  [UNSIGNED_JWT_HEADER, JSON.stringify(claims)]
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
  const traceId =
    incoming && TRACE_ID_PATTERN.test(incoming) ? incoming : randomUUID()

  const callChain = [
    ...(header(headers, CALL_CHAIN_HEADER)
      ?.split(',')
      .map(s => s.trim())
      .filter(s => CALL_CHAIN_ENTRY_PATTERN.test(s)) ?? []),
    selfServiceId
  ].slice(-MAX_CALL_CHAIN)

  const jwt =
    jwtOverride ??
    header(headers, AUTHORIZATION_HEADER)?.replace(BEARER_PREFIX, '')
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
  permission: PermissionName
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
