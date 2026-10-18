import { createTRPCClient, httpLink } from '@trpc/client'
import type { TRPCLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { REQUEST_ID_HEADER, SERVICE_ID_HEADER } from './context'

export interface CallContext {
  /** End user's JWT; pass it only when the callee needs the user's identity. */
  jwt?: string
  requestId?: string
}

export const fetchWithTimeout =
  (timeoutMs: number): typeof fetch =>
  (input, init) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(init?.signal ? [init.signal] : [])])
    })

/**
 * Typed service-to-service client. Per-call identity goes through the tRPC call context:
 * `client.x.query(input, { context: { jwt: ctx.jwt, requestId: ctx.requestId } satisfies CallContext })`.
 * Uses httpLink (not httpBatchLink) because batched calls would share one authorization header.
 */
export const createServiceClient = <R extends AnyTRPCRouter>(opts: {
  url: string
  serviceId: string
  timeoutMs: number
}) =>
  createTRPCClient<R>({
    links: [
      httpLink<AnyTRPCRouter['_def']['_config']['$types']>({
        url: opts.url,
        fetch: fetchWithTimeout(opts.timeoutMs),
        headers: ({ op }) => {
          const { jwt, requestId } = (op.context ?? {}) as CallContext
          return {
            [SERVICE_ID_HEADER]: opts.serviceId,
            ...(requestId && { [REQUEST_ID_HEADER]: requestId }),
            ...(jwt && { authorization: `Bearer ${jwt}` })
          }
        }
      }) as TRPCLink<R>
    ]
  })
