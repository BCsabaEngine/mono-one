import { TRPCClientError } from '@trpc/client'
import { initTRPC, TRPCError } from '@trpc/server'
import { DomainError } from '../errors'
import type { DomainErrorCode } from '../errors'
import type { BaseContext } from './context'

const CODES: Record<DomainErrorCode, TRPCError['code']> = {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL: 'INTERNAL_SERVER_ERROR'
}

export const toTRPCError = (err: unknown): TRPCError =>
  err instanceof TRPCError
    ? err
    : err instanceof DomainError
      ? new TRPCError({ code: CODES[err.code], message: err.message, cause: err })
      : new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Internal error', cause: err })

/** initTRPC + the single place where domain errors become TRPCErrors; unknown errors are logged and masked. */
export const createTRPC = <Ctx extends BaseContext>() => {
  const t = initTRPC.context<Ctx>().create()
  const procedure = t.procedure.use(async ({ ctx, path, next }) => {
    const result = await next()
    if (result.ok) return result
    const { cause } = result.error
    if (!(cause instanceof DomainError) && result.error.code === 'INTERNAL_SERVER_ERROR')
      ctx.log.error({ err: cause ?? result.error, path }, 'unhandled error')
    throw cause instanceof DomainError ? toTRPCError(cause) : result.error
  })
  return { t, router: t.router, procedure, mergeRouters: t.mergeRouters }
}

/** Re-raises an error from a downstream tRPC call with its original code, so the BFF/callers see NOT_FOUND, not INTERNAL. */
export const fromClientError = (err: unknown): never => {
  const code = err instanceof TRPCClientError ? (err.data?.code as TRPCError['code'] | undefined) : undefined
  throw code ? new TRPCError({ code, message: (err as Error).message, cause: err }) : err
}
