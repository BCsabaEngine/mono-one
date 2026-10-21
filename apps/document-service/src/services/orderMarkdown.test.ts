import { describe, expect, it } from 'vitest'
import type { Address, CustomerSummary } from '@api/customer'
import type { Order } from '@api/order'
import { renderOrderMarkdown } from './orderMarkdown'

const stamps = {
  createdAt: '2026-10-18T08:30:00.000Z',
  updatedAt: '2026-10-18T08:30:00.000Z'
}

const detail = (over: Partial<Order['details'][number]> = {}) => ({
  id: 1,
  orderId: 5,
  productCode: 'P-1',
  productName: 'Widget',
  quantity: 2,
  unitPrice: 500,
  netValue: 1000,
  ...stamps,
  ...over
})

const makeOrder = (over: Partial<Order> = {}): Order => ({
  id: 5,
  customerId: 7,
  title: 'Spring delivery',
  comment: null,
  deliveryAddressId: 3,
  details: [detail()],
  ...stamps,
  ...over
})

const address = (over: Partial<Address> = {}) => ({
  id: 3,
  customerId: 7,
  type: 'hq' as const,
  name: null,
  country: 'HU' as const,
  zip: '1051',
  city: 'Budapest',
  address: 'Fo utca 1',
  ...stamps,
  deletedAt: null,
  ...over
})

const makeCustomer = (
  over: Partial<CustomerSummary> = {}
): CustomerSummary => ({
  id: 7,
  code: 'C-0007',
  name: 'Test Customer',
  address: address(),
  ...over
})

const render = (order = makeOrder(), customer = makeCustomer()) =>
  renderOrderMarkdown(order, customer)

describe('renderOrderMarkdown', () => {
  it('renders the whole document', () => {
    const order = makeOrder({
      comment: 'Ring twice',
      details: [
        detail(),
        detail({
          id: 2,
          productCode: 'P-2',
          productName: 'Gadget',
          quantity: 1,
          unitPrice: 990,
          netValue: 990
        })
      ]
    })

    expect(render(order)).toBe(
      [
        '# Order 5: Spring delivery',
        '',
        'Date: 2026-10-18',
        '',
        '## Customer',
        '',
        'Test Customer (C-0007)',
        '',
        '## Delivery address',
        '',
        'Fo utca 1, 1051 Budapest, HU',
        '',
        '## Items',
        '',
        '| Code | Product | Quantity | Unit price | Net value |',
        '| --- | --- | ---: | ---: | ---: |',
        '| P-1 | Widget | 2 | 5.00 | 10.00 |',
        '| P-2 | Gadget | 1 | 9.90 | 9.90 |',
        '',
        '**Total: 19.90**',
        '',
        '## Comment',
        '',
        'Ring twice',
        ''
      ].join('\n')
    )
  })

  describe('money', () => {
    it.each([
      [0, '0.00'],
      [5, '0.05'],
      [990, '9.90'],
      [1005, '10.05'],
      [19999, '199.99'],
      [100_000_000, '1000000.00']
    ])('formats %d minor units as %s', (minor, text) => {
      const order = makeOrder({
        details: [detail({ unitPrice: minor, netValue: minor })]
      })

      expect(render(order)).toContain(`| 2 | ${text} | ${text} |`)
      expect(render(order)).toContain(`**Total: ${text}**`)
    })

    it('totals the net values, not quantity times unit price', () => {
      const order = makeOrder({
        details: [
          detail({ quantity: 3, unitPrice: 100, netValue: 250 }),
          detail({ id: 2, netValue: 50 })
        ]
      })

      expect(render(order)).toContain('**Total: 3.00**')
    })

    it('renders a zero total and no rows for an order without details', () => {
      const markdown = render(makeOrder({ details: [] }))

      expect(markdown).toContain(
        '| --- | --- | ---: | ---: | ---: |\n\n**Total: 0.00**'
      )
    })
  })

  describe('date', () => {
    it('is the UTC day of createdAt', () => {
      expect(
        render(makeOrder({ createdAt: '2026-10-18T23:59:59.000Z' }))
      ).toContain('Date: 2026-10-18')
    })
  })

  describe('escaping', () => {
    it('escapes pipes and flattens whitespace in the title, customer and items', () => {
      const markdown = render(
        makeOrder({
          title: 'A | B\n# Injected',
          details: [
            detail({ productCode: 'P|1', productName: 'Big \t  Widget\n| XL' })
          ]
        }),
        makeCustomer({ name: 'Acme | Co\nKft', code: ' C | 1 ' })
      )

      expect(markdown).toContain('# Order 5: A \\| B # Injected\n')
      expect(markdown).toContain('Acme \\| Co Kft (C \\| 1)\n')
      expect(markdown).toContain('| P\\|1 | Big Widget \\| XL | 2 |')
    })

    it('escapes the address parts', () => {
      const customer = makeCustomer({
        address: address({
          name: 'HQ | North',
          address: 'Fo\nutca 1',
          city: 'Buda  pest'
        })
      })

      expect(render(makeOrder(), customer)).toContain(
        'HQ \\| North, Fo utca 1, 1051 Buda pest, HU'
      )
    })

    // pinned as is: only the comment body is emitted verbatim (trimmed)
    it('does not escape the comment', () => {
      const markdown = render(makeOrder({ comment: '  line1\n## Fake | x  ' }))

      expect(markdown).toContain('## Comment\n\nline1\n## Fake | x\n')
    })
  })

  describe('delivery address', () => {
    it('puts the name first when there is one', () => {
      const customer = makeCustomer({
        address: address({ name: 'Warehouse' })
      })

      expect(render(makeOrder(), customer)).toContain(
        'Warehouse, Fo utca 1, 1051 Budapest, HU'
      )
    })

    it('leaves out a null or empty name', () => {
      const empty = makeCustomer({ address: address({ name: '' }) })

      expect(render(makeOrder(), makeCustomer())).toContain(
        '\nFo utca 1, 1051 Budapest, HU\n'
      )
      expect(render(makeOrder(), empty)).toContain(
        '\nFo utca 1, 1051 Budapest, HU\n'
      )
    })

    it('says so when the address is gone', () => {
      const customer = makeCustomer({ address: null })

      expect(render(makeOrder(), customer)).toContain(
        '## Delivery address\n\nAddress 3 (no longer available)\n'
      )
    })

    // pinned as is: the customer service returns only active addresses, the renderer does not check deletedAt
    it('still renders an address that carries a deletedAt', () => {
      const customer = makeCustomer({
        address: address({ deletedAt: '2026-10-19T00:00:00.000Z' })
      })

      expect(render(makeOrder(), customer)).toContain(
        'Fo utca 1, 1051 Budapest, HU'
      )
    })
  })

  describe('comment', () => {
    it.each([null, ''])('has no comment section for %j', comment => {
      expect(render(makeOrder({ comment }))).not.toContain('## Comment')
    })

    it('trims the comment and ends the document with a newline', () => {
      const markdown = render(makeOrder({ comment: '  Ring twice \n' }))

      expect(markdown.endsWith('## Comment\n\nRing twice\n')).toBe(true)
    })

    // pinned as is: whitespace-only is truthy
    it('renders an empty section for a whitespace-only comment', () => {
      expect(render(makeOrder({ comment: '   ' }))).toContain(
        '## Comment\n\n\n'
      )
    })
  })

  describe('customer', () => {
    it('ends the document with a newline', () => {
      expect(render().endsWith('\n')).toBe(true)
    })
  })
})
