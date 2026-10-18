export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL'

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export const notFound = (what: string, id?: string) =>
  new DomainError(
    'NOT_FOUND',
    id ? `${what} ${id} not found` : `${what} not found`
  )
export const badRequest = (message: string, details?: unknown) =>
  new DomainError('BAD_REQUEST', message, details)
export const conflict = (message: string) =>
  new DomainError('CONFLICT', message)
export const forbidden = (message = 'Forbidden') =>
  new DomainError('FORBIDDEN', message)
export const unauthorized = (message = 'Unauthorized') =>
  new DomainError('UNAUTHORIZED', message)

/** Postgres unique violation (23505), also when wrapped in a `cause` chain (Drizzle wraps driver errors). */
export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  ('code' in err
    ? err.code === '23505'
    : 'cause' in err && isUniqueViolation(err.cause))
