import { describe, expect, it } from 'vitest'
import { toDetail } from './mappers'

describe('toDetail', () => {
  const row = {
    id: 1,
    orderId: 5,
    productCode: 'P-1',
    productName: 'Widget',
    quantity: 2,
    unitPrice: 500,
    netValue: 1000,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T03:04:05.000Z')
  }

  it('keeps the columns and turns the dates into ISO strings', () => {
    expect(toDetail(row)).toEqual({
      ...row,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z'
    })
  })

  it('has no deletedAt (details are hard deleted)', () => {
    expect(toDetail(row)).not.toHaveProperty('deletedAt')
  })
})
