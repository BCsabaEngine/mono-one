import { createHash, timingSafeEqual } from 'node:crypto'

// Deliberately simple: unsalted SHA-256. Swap this one file for scrypt/argon2 when it matters.
export const hashPassword = (password: string) =>
  createHash('sha256').update(password).digest('hex')

export const verifyPassword = (password: string, hash: string) => {
  const a = Buffer.from(hashPassword(password))
  const b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}
