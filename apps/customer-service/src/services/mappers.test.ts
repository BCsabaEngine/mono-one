import { describe, expect, it } from 'vitest'
import { toAddress, toContact } from './mappers'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T03:04:05.000Z')

describe('mappers', () => {
  describe('toAddress', () => {
    const row = {
      id: 1,
      customerId: 2,
      type: 'hq',
      name: null,
      country: 'HU',
      zip: '1051',
      city: 'Budapest',
      address: 'Fo utca 1',
      createdAt,
      updatedAt,
      deletedAt: null
    } as const

    it('keeps the columns and turns the dates into ISO strings', () => {
      expect(toAddress(row)).toEqual({
        ...row,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
        deletedAt: null
      })
    })

    it('maps a set deletedAt to an ISO string', () => {
      expect(toAddress({ ...row, deletedAt: updatedAt }).deletedAt).toBe(
        '2026-01-02T03:04:05.000Z'
      )
    })
  })

  describe('toContact', () => {
    const row = {
      id: 1,
      customerId: 2,
      type: 'sales',
      name: 'Eva',
      phone: null,
      email: 'eva@mono.hu',
      createdAt,
      updatedAt,
      deletedAt: null
    } as const

    it('keeps the columns and turns the dates into ISO strings', () => {
      expect(toContact(row)).toEqual({
        ...row,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
        deletedAt: null
      })
    })

    it('maps a set deletedAt to an ISO string', () => {
      expect(toContact({ ...row, deletedAt: createdAt }).deletedAt).toBe(
        '2026-01-01T00:00:00.000Z'
      )
    })
  })
})
