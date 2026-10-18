import { randomUUID } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import { z } from 'zod'
import { forbidden, unauthorized } from '../errors'
import type { Logger } from '../logging'
import { withRequestId } from '../logging'

export const REQUEST_ID_HEADER = 'x-request-id'
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
  requestId: string
  serviceId?: string
  /** Raw bearer token, forwarded to other services only when they need the user's identity. */
  jwt?: string
  identity?: Identity
}

const header = (h: IncomingHttpHeaders | Headers, name: string) => {
  const v = h instanceof Headers ? h.get(name) : h[name]
  return (Array.isArray(v) ? v[0] : v) ?? undefined
}

export const baseContextFromHeaders = (
  headers: IncomingHttpHeaders | Headers,
  log: Logger
): BaseContext => {
  const requestId = header(headers, REQUEST_ID_HEADER) ?? randomUUID()
  const jwt = header(headers, 'authorization')?.replace(/^Bearer\s+/i, '')
  const identity = jwt ? decodeJwt(jwt) : undefined
  const serviceId = header(headers, SERVICE_ID_HEADER)
  return {
    log: withRequestId(log, requestId),
    requestId,
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
