import { describe, expect, it } from 'vitest'
import {
  ADDRESS_TYPES,
  CONTACT_TYPES,
  EU_COUNTRIES,
  addAddressInput,
  addContactInput,
  addCustomerInput,
  addressSchema,
  customerSchema,
  deleteInput,
  getCustomerInput,
  listCustomersInput,
  updateAddressInput,
  updateContactInput,
  updateCustomerInput
} from '@api/customer'

const address = {
  customerId: 1,
  type: 'hq',
  country: 'HU',
  zip: '1051',
  city: 'Budapest',
  address: 'Fo utca 1'
} as const

const contact = { customerId: 1, type: 'sales', name: 'Eva' } as const

const stamps = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  deletedAt: null
}

describe('customer contract', () => {
  describe('ids', () => {
    it.each([0, -1, 1.5, '1', null])('rejects id %j', value => {
      expect(getCustomerInput.safeParse({ id: value }).success).toBe(false)
      expect(deleteInput.safeParse({ id: value }).success).toBe(false)
    })

    it('accepts a positive integer id', () => {
      expect(getCustomerInput.parse({ id: 7 })).toEqual({ id: 7 })
    })

    it('accepts 1..100 ids and keeps their order and duplicates', () => {
      expect(listCustomersInput.parse({ ids: [3, 1, 3] })).toEqual({
        ids: [3, 1, 3]
      })
      expect(
        listCustomersInput.safeParse({
          ids: Array.from({ length: 100 }, (_, i) => i + 1)
        }).success
      ).toBe(true)
    })

    it.each([
      ['empty', []],
      ['more than 100', Array.from({ length: 101 }, (_, i) => i + 1)],
      ['a zero', [1, 0]],
      ['a fraction', [1.5]]
    ])('rejects a list with %s', (_, ids) => {
      expect(listCustomersInput.safeParse({ ids }).success).toBe(false)
    })
  })

  describe('customer input', () => {
    it('trims text fields', () => {
      expect(
        addCustomerInput.parse({
          code: '  C-1 ',
          name: ' ACME ',
          comment: ' x '
        })
      ).toEqual({ code: 'C-1', name: 'ACME', comment: 'x' })
    })

    it.each(['', '   '])('rejects %j as code and name', value => {
      expect(
        addCustomerInput.safeParse({ code: value, name: 'A' }).success
      ).toBe(false)
      expect(
        addCustomerInput.safeParse({ code: 'C', name: value }).success
      ).toBe(false)
    })

    it('treats comment as optional and nullable', () => {
      expect(addCustomerInput.parse({ code: 'C', name: 'A' })).toEqual({
        code: 'C',
        name: 'A'
      })
      expect(
        addCustomerInput.parse({ code: 'C', name: 'A', comment: null }).comment
      ).toBeNull()
    })

    it('requires only the id on update; omitted stays absent and null is kept', () => {
      expect(updateCustomerInput.parse({ id: 1 })).toEqual({ id: 1 })
      expect(updateCustomerInput.parse({ id: 1, comment: null })).toEqual({
        id: 1,
        comment: null
      })
      expect(updateCustomerInput.safeParse({ name: 'A' }).success).toBe(false)
      expect(updateCustomerInput.safeParse({ id: 1, name: ' ' }).success).toBe(
        false
      )
    })
  })

  describe('address input', () => {
    it.each(ADDRESS_TYPES)('accepts the type %s', type => {
      expect(addAddressInput.safeParse({ ...address, type }).success).toBe(true)
    })

    it.each(EU_COUNTRIES)('accepts the EU country %s', country => {
      expect(addAddressInput.safeParse({ ...address, country }).success).toBe(
        true
      )
    })

    it.each(['US', 'GB', 'hu', ''])('rejects the country %j', country => {
      expect(addAddressInput.safeParse({ ...address, country }).success).toBe(
        false
      )
    })

    it('rejects an unknown type', () => {
      expect(
        addAddressInput.safeParse({ ...address, type: 'home' }).success
      ).toBe(false)
    })

    it.each(['zip', 'city', 'address'])('rejects a blank %s', field => {
      expect(
        addAddressInput.safeParse({ ...address, [field]: '  ' }).success
      ).toBe(false)
    })

    it('requires the customer id and treats name as optional and nullable', () => {
      const withoutCustomer = { ...address, customerId: undefined }

      expect(addAddressInput.safeParse(withoutCustomer).success).toBe(false)
      expect(addAddressInput.parse(address)).not.toHaveProperty('name')
      expect(addAddressInput.parse({ ...address, name: null }).name).toBeNull()
    })

    it('requires only the id on update', () => {
      expect(updateAddressInput.parse({ id: 2 })).toEqual({ id: 2 })
      expect(updateAddressInput.parse({ id: 2, name: null })).toEqual({
        id: 2,
        name: null
      })
      expect(
        updateAddressInput.safeParse({ id: 2, country: 'US' }).success
      ).toBe(false)
    })
  })

  describe('contact input', () => {
    it.each(CONTACT_TYPES)('accepts the type %s', type => {
      expect(addContactInput.safeParse({ ...contact, type }).success).toBe(true)
    })

    it('rejects an unknown type and a blank name', () => {
      expect(
        addContactInput.safeParse({ ...contact, type: 'boss' }).success
      ).toBe(false)
      expect(addContactInput.safeParse({ ...contact, name: ' ' }).success).toBe(
        false
      )
    })

    it('validates the email format; phone and email are optional and nullable', () => {
      expect(
        addContactInput.safeParse({ ...contact, email: 'not-an-email' }).success
      ).toBe(false)
      expect(
        addContactInput.parse({ ...contact, email: 'eva@mono.hu', phone: null })
      ).toMatchObject({ email: 'eva@mono.hu', phone: null })
      expect(addContactInput.parse(contact)).toEqual(contact)
    })

    it('requires only the id on update', () => {
      expect(updateContactInput.parse({ id: 3 })).toEqual({ id: 3 })
      expect(updateContactInput.parse({ id: 3, email: null })).toEqual({
        id: 3,
        email: null
      })
      expect(updateContactInput.safeParse({ id: 3, email: 'x' }).success).toBe(
        false
      )
    })
  })

  describe('output schemas', () => {
    const row = { id: 1, ...address, name: null, ...stamps }

    it('accepts ISO timestamps and a null or set deletedAt', () => {
      expect(addressSchema.safeParse(row).success).toBe(true)
      expect(
        addressSchema.safeParse({
          ...row,
          deletedAt: '2026-02-01T00:00:00.000Z'
        }).success
      ).toBe(true)
    })

    it('rejects a non-ISO timestamp and a missing deletedAt', () => {
      expect(
        addressSchema.safeParse({ ...row, createdAt: 'yesterday' }).success
      ).toBe(false)

      const withoutDeletedAt = { ...row, deletedAt: undefined }

      expect(addressSchema.safeParse(withoutDeletedAt).success).toBe(false)
    })

    it('nests addresses and contacts in a customer', () => {
      const customer = {
        id: 1,
        code: 'C-1',
        name: 'ACME',
        comment: null,
        addresses: [row],
        contacts: [],
        ...stamps
      }

      expect(customerSchema.safeParse(customer).success).toBe(true)
      expect(
        customerSchema.safeParse({ ...customer, addresses: [{ id: 1 }] })
          .success
      ).toBe(false)
    })
  })

  describe('domain lists', () => {
    it('has the 27 EU member states without duplicates', () => {
      expect(EU_COUNTRIES).toHaveLength(27)
      expect(new Set(EU_COUNTRIES).size).toBe(27)
    })

    it('has unique address and contact types', () => {
      expect(new Set(ADDRESS_TYPES).size).toBe(ADDRESS_TYPES.length)
      expect(new Set(CONTACT_TYPES).size).toBe(CONTACT_TYPES.length)
    })
  })
})
