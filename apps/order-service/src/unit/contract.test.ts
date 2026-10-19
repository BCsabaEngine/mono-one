import { describe, expect, it } from 'vitest'
import {
  addOrderDetailInput,
  createOrderInput,
  deleteInput,
  getOrderInput,
  listOrdersInput,
  orderDetailSchema,
  orderSchema
} from '@api/order'

// the caps from contract.ts
const MAX_QUANTITY = 100_000
const MAX_UNIT_PRICE = 100_000_000
const MAX_DETAILS = 200

const line = {
  productCode: 'P-1',
  productName: 'Widget',
  quantity: 2,
  unitPrice: 500
}

const order = {
  customerId: 1,
  title: 'Spring delivery',
  deliveryAddressId: 3,
  details: [line]
}

const stamps = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
}

const detailDto = { id: 1, orderId: 5, ...line, netValue: 1000, ...stamps }

const orderDto = {
  id: 5,
  customerId: 1,
  title: 'Spring delivery',
  comment: null,
  deliveryAddressId: 3,
  details: [detailDto],
  ...stamps
}

describe('order contract', () => {
  describe('ids', () => {
    it.each([0, -1, 1.5, '1', null])('rejects id %j', value => {
      expect(getOrderInput.safeParse({ id: value }).success).toBe(false)
      expect(deleteInput.safeParse({ id: value }).success).toBe(false)
    })

    it('accepts a positive integer id', () => {
      expect(getOrderInput.parse({ id: 7 })).toEqual({ id: 7 })
    })
  })

  describe('create input', () => {
    it('trims the text fields', () => {
      const parsed = createOrderInput.parse({
        ...order,
        title: '  Spring ',
        comment: ' hi ',
        details: [{ ...line, productCode: ' P-1 ', productName: ' Widget ' }]
      })

      expect(parsed.title).toBe('Spring')
      expect(parsed.comment).toBe('hi')
      expect(parsed.details[0]).toMatchObject({
        productCode: 'P-1',
        productName: 'Widget'
      })
    })

    it('treats comment as optional and nullable, but not empty', () => {
      expect(createOrderInput.parse(order)).not.toHaveProperty('comment')
      expect(
        createOrderInput.parse({ ...order, comment: null }).comment
      ).toBeNull()
      expect(
        createOrderInput.safeParse({ ...order, comment: '' }).success
      ).toBe(false)
      expect(
        createOrderInput.safeParse({ ...order, comment: '  ' }).success
      ).toBe(false)
    })

    it.each(['customerId', 'deliveryAddressId'])(
      'requires a positive %s',
      field => {
        expect(
          createOrderInput.safeParse({ ...order, [field]: 0 }).success
        ).toBe(false)
        expect(
          createOrderInput.safeParse({ ...order, [field]: undefined }).success
        ).toBe(false)
      }
    )

    it('rejects a blank title', () => {
      expect(createOrderInput.safeParse({ ...order, title: ' ' }).success).toBe(
        false
      )
    })

    it('needs 1..200 details', () => {
      const many = (n: number) => Array.from({ length: n }, () => line)

      expect(
        createOrderInput.safeParse({ ...order, details: [] }).success
      ).toBe(false)
      expect(
        createOrderInput.safeParse({ ...order, details: many(MAX_DETAILS) })
          .success
      ).toBe(true)
      expect(
        createOrderInput.safeParse({ ...order, details: many(MAX_DETAILS + 1) })
          .success
      ).toBe(false)
    })

    it.each(['productCode', 'productName'])(
      'rejects a blank detail %s',
      field => {
        expect(
          createOrderInput.safeParse({
            ...order,
            details: [{ ...line, [field]: '  ' }]
          }).success
        ).toBe(false)
      }
    )
  })

  describe('quantity and unit price', () => {
    const parse = (over: object) =>
      addOrderDetailInput.safeParse({ orderId: 5, ...line, ...over }).success

    it('accepts the boundaries', () => {
      expect(parse({ quantity: 1, unitPrice: 1 })).toBe(true)
      expect(parse({ quantity: MAX_QUANTITY, unitPrice: MAX_UNIT_PRICE })).toBe(
        true
      )
    })

    it.each([0, -1, 1.5, MAX_QUANTITY + 1, '2'])(
      'rejects the quantity %j',
      quantity => {
        expect(parse({ quantity })).toBe(false)
      }
    )

    it.each([0, -1, 0.5, MAX_UNIT_PRICE + 1, '5'])(
      'rejects the unit price %j',
      unitPrice => {
        expect(parse({ unitPrice })).toBe(false)
      }
    )

    it('keeps the sum of a maximal order a safe integer', () => {
      expect(MAX_QUANTITY * MAX_UNIT_PRICE * MAX_DETAILS).toBeLessThan(
        Number.MAX_SAFE_INTEGER
      )
    })

    it('requires the order id on addOrderDetailInput', () => {
      expect(addOrderDetailInput.safeParse(line).success).toBe(false)
      expect(
        addOrderDetailInput.safeParse({ orderId: 0, ...line }).success
      ).toBe(false)
    })
  })

  describe('list input', () => {
    it('defaults to the first page of 50', () => {
      expect(listOrdersInput.parse({})).toEqual({ limit: 50, offset: 0 })
    })

    it('keeps the customer filter, limit and offset', () => {
      expect(
        listOrdersInput.parse({ customerId: 4, limit: 10, offset: 20 })
      ).toEqual({ customerId: 4, limit: 10, offset: 20 })
    })

    it.each([
      [{ limit: 0 }],
      [{ limit: 101 }],
      [{ limit: 1.5 }],
      [{ offset: -1 }],
      [{ offset: 0.5 }],
      [{ customerId: 0 }]
    ])('rejects %j', input => {
      expect(listOrdersInput.safeParse(input).success).toBe(false)
    })

    it('accepts limit 1 and 100', () => {
      expect(listOrdersInput.parse({ limit: 1 }).limit).toBe(1)
      expect(listOrdersInput.parse({ limit: 100 }).limit).toBe(100)
    })
  })

  describe('output schemas', () => {
    it('accepts an order with details and a null or set comment', () => {
      expect(orderSchema.safeParse(orderDto).success).toBe(true)
      expect(orderSchema.safeParse({ ...orderDto, comment: 'x' }).success).toBe(
        true
      )
    })

    it('strips fields that are not part of the order (e.g. deletedAt)', () => {
      expect(
        orderSchema.parse({ ...orderDto, deletedAt: null })
      ).not.toHaveProperty('deletedAt')
    })

    it('rejects a non-ISO date and a missing comment', () => {
      expect(
        orderSchema.safeParse({ ...orderDto, createdAt: 'yesterday' }).success
      ).toBe(false)
      expect(
        orderSchema.safeParse({ ...orderDto, comment: undefined }).success
      ).toBe(false)
    })

    it('requires a positive net value on a detail', () => {
      expect(orderDetailSchema.safeParse(detailDto).success).toBe(true)
      expect(
        orderDetailSchema.safeParse({ ...detailDto, netValue: 0 }).success
      ).toBe(false)
    })
  })
})
