import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

// the seeded starter user (hello@mono.hu / hello) is stored with this hash
const HELLO_SHA256 =
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'

describe('password', () => {
  describe('hashPassword', () => {
    it('is the SHA-256 hex of the password', () => {
      expect(hashPassword('hello')).toBe(HELLO_SHA256)
      expect(hashPassword('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      )
    })

    it('is 64 lowercase hex characters, also for unicode', () => {
      expect(hashPassword('árvíztűrő tükörfúrógép')).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic and unsalted', () => {
      expect(hashPassword('same')).toBe(hashPassword('same'))
      expect(hashPassword('a')).not.toBe(hashPassword('b'))
    })
  })

  describe('verifyPassword', () => {
    it('accepts the matching hash', () => {
      expect(verifyPassword('hello', HELLO_SHA256)).toBe(true)
    })

    it('rejects a wrong password', () => {
      expect(verifyPassword('Hello', HELLO_SHA256)).toBe(false)
      expect(verifyPassword('', HELLO_SHA256)).toBe(false)
    })

    it.each([
      ['empty', ''],
      ['too short', HELLO_SHA256.slice(0, 63)],
      ['too long', `${HELLO_SHA256}0`],
      ['uppercase', HELLO_SHA256.toUpperCase()],
      ['not hex', 'z'.repeat(64)]
    ])('rejects a %s hash without throwing', (_, hash) => {
      expect(verifyPassword('hello', hash)).toBe(false)
    })
  })
})
