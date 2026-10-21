import type { z } from 'zod'

/**
 * `.output(schema)` for large read responses built by our own mappers: validated everywhere except production,
 * where parsing every row again (datetime regexes, nested arrays) costs more than it protects.
 * Do not use it where the schema strips fields (e.g. `users.*` drops `password`).
 */
export const checkedOutsideProduction = <S extends z.ZodType>(schema: S): S =>
  (process.env.NODE_ENV === 'production'
    ? (value: unknown) => value
    : schema) as unknown as S // the type stays the schema's, so clients infer the same output
