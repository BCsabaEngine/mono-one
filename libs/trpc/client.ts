import { createTRPCClient, httpLink } from '@trpc/client'
import type { TRPCLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import {
  CALL_CHAIN_HEADER,
  SERVICE_ID_HEADER,
  TRACE_ID_HEADER
} from './context'

export interface CallContext {
  /** End user's JWT; pass it only when the callee needs the user's identity. */
  jwt?: string
  traceId?: string
  /** Chain including the calling service; the callee appends itself. */
  callChain?: string[]
  /** Not sent as a header (the JWT carries it); events put it in the envelope. */
  userId?: string
}

export const fetchWithTimeout =
  (timeoutMs: number): typeof fetch =>
  (input, init) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.any([
        AbortSignal.timeout(timeoutMs),
        ...(init?.signal ? [init.signal] : [])
      ])
    })

/**
 * Typed service-to-service client. Per-call identity goes through the tRPC call context:
 * `client.x.query(input, { context: callContextOf(ctx) })`.
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
          const { jwt, traceId, callChain } = (op.context ?? {}) as CallContext
          return {
            [SERVICE_ID_HEADER]: opts.serviceId,
            ...(traceId && { [TRACE_ID_HEADER]: traceId }),
            ...(callChain?.length && {
              [CALL_CHAIN_HEADER]: callChain.join(',')
            }),
            ...(jwt && { authorization: `Bearer ${jwt}` })
          }
        }
      }) as TRPCLink<R>
    ]
  })
