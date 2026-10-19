import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  addUserInput,
  authUserInput,
  deleteUserInput,
  getUserInput,
  getUsersInput,
  updateUserInput,
  userSchema
} from '@api/system'

const stamps = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  deletedAt: null
}

const user = {
  id: 1,
  email: 'hello@mono.hu',
  name: 'Hello',
  permissions: ['user.admin'],
  ...stamps
}

describe('system contract', () => {
  describe('ids', () => {
    it.each([0, -1, 1.5, '1', null])('rejects id %j', value => {
      expect(getUserInput.safeParse({ id: value }).success).toBe(false)
      expect(deleteUserInput.safeParse({ id: value }).success).toBe(false)
    })

    it('accepts a positive integer id', () => {
      expect(getUserInput.parse({ id: 3 })).toEqual({ id: 3 })
    })

    it('accepts 1..100 ids', () => {
      expect(getUsersInput.parse({ ids: [2, 1, 2] })).toEqual({
        ids: [2, 1, 2]
      })
      expect(
        getUsersInput.safeParse({
          ids: Array.from({ length: 100 }, (_, i) => i + 1)
        }).success
      ).toBe(true)
    })

    it.each([
      ['empty', []],
      ['more than 100', Array.from({ length: 101 }, (_, i) => i + 1)],
      ['a zero', [0]]
    ])('rejects a list with %s', (_, ids) => {
      expect(getUsersInput.safeParse({ ids }).success).toBe(false)
    })
  })

  describe('auth input', () => {
    it('accepts an email and a password', () => {
      expect(
        authUserInput.parse({ email: 'a@b.hu', password: 'secret' })
      ).toEqual({ email: 'a@b.hu', password: 'secret' })
    })

    it.each(['nope', '', 'a@', '@b.hu'])('rejects the email %j', email => {
      expect(authUserInput.safeParse({ email, password: 'x' }).success).toBe(
        false
      )
    })

    it('rejects an empty password', () => {
      expect(
        authUserInput.safeParse({ email: 'a@b.hu', password: '' }).success
      ).toBe(false)
    })
  })

  describe('add input', () => {
    const base = { email: 'a@b.hu', name: 'A', password: 'secret' }

    it('defaults permissions to an empty list', () => {
      expect(addUserInput.parse(base).permissions).toEqual([])
    })

    it.each(PERMISSIONS)('accepts the permission %s', permission => {
      expect(
        addUserInput.parse({ ...base, permissions: [permission] }).permissions
      ).toEqual([permission])
    })

    it('rejects an unknown permission', () => {
      expect(
        addUserInput.safeParse({ ...base, permissions: ['root'] }).success
      ).toBe(false)
    })

    it.each(['email', 'name', 'password'])('requires %s', field => {
      expect(
        addUserInput.safeParse({ ...base, [field]: undefined }).success
      ).toBe(false)
    })

    it.each(['name', 'password'])('rejects an empty %s', field => {
      expect(addUserInput.safeParse({ ...base, [field]: '' }).success).toBe(
        false
      )
    })

    it('rejects a bad email', () => {
      expect(addUserInput.safeParse({ ...base, email: 'nope' }).success).toBe(
        false
      )
    })
  })

  describe('update input', () => {
    it('requires only the id; omitted fields stay absent', () => {
      expect(updateUserInput.parse({ id: 1 })).toEqual({ id: 1 })
      expect(updateUserInput.safeParse({ name: 'A' }).success).toBe(false)
    })

    it('keeps an empty permission list (clears all) apart from an omitted one', () => {
      expect(updateUserInput.parse({ id: 1, permissions: [] })).toEqual({
        id: 1,
        permissions: []
      })
    })

    it('rejects an empty name or password and an unknown permission', () => {
      expect(updateUserInput.safeParse({ id: 1, name: '' }).success).toBe(false)
      expect(updateUserInput.safeParse({ id: 1, password: '' }).success).toBe(
        false
      )
      expect(
        updateUserInput.safeParse({ id: 1, permissions: ['root'] }).success
      ).toBe(false)
    })
  })

  describe('user schema', () => {
    it('accepts a user with a null or set deletedAt', () => {
      expect(userSchema.safeParse(user).success).toBe(true)
      expect(
        userSchema.safeParse({ ...user, deletedAt: '2026-02-01T00:00:00.000Z' })
          .success
      ).toBe(true)
    })

    it('never carries a password', () => {
      const parsed = userSchema.parse({
        ...user,
        password: 'abc',
        passwordHash: 'def'
      })

      expect(parsed).not.toHaveProperty('password')
      expect(parsed).not.toHaveProperty('passwordHash')
    })

    it('rejects a bad email, a non-ISO date and an unknown permission', () => {
      expect(userSchema.safeParse({ ...user, email: 'nope' }).success).toBe(
        false
      )
      expect(
        userSchema.safeParse({ ...user, createdAt: 'yesterday' }).success
      ).toBe(false)
      expect(
        userSchema.safeParse({ ...user, permissions: ['root'] }).success
      ).toBe(false)
    })
  })

  it('exposes the permission list with user.admin', () => {
    expect(PERMISSIONS).toContain('user.admin')
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })
})
