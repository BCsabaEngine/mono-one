import type { Customer } from '@api/customer'
import type { Order } from '@api/order'

// money is in minor units; the currency is not part of the order yet
const money = (minor: number) => (minor / 100).toFixed(2)

/** Keeps user text from breaking the table or the heading structure. */
const cell = (text: string) =>
  text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

const date = (iso: string) => iso.slice(0, 10)

/** Pure rendering of the order document; the PDF variant will start from the same data. */
export const renderOrderMarkdown = (order: Order, customer: Customer) => {
  const delivery = customer.addresses.find(
    a => a.id === order.deliveryAddressId
  )
  const total = order.details.reduce((sum, d) => sum + d.netValue, 0)

  return [
    `# Order ${order.id}: ${cell(order.title)}`,
    '',
    `Date: ${date(order.createdAt)}`,
    '',
    '## Customer',
    '',
    `${cell(customer.name)} (${cell(customer.code)})`,
    '',
    '## Delivery address',
    '',
    delivery
      ? `${[delivery.name && cell(delivery.name), cell(delivery.address), `${cell(delivery.zip)} ${cell(delivery.city)}`, delivery.country].filter(Boolean).join(', ')}`
      : `Address ${order.deliveryAddressId} (no longer available)`,
    '',
    '## Items',
    '',
    '| Code | Product | Quantity | Unit price | Net value |',
    '| --- | --- | ---: | ---: | ---: |',
    ...order.details.map(
      d =>
        `| ${cell(d.productCode)} | ${cell(d.productName)} | ${d.quantity} | ${money(d.unitPrice)} | ${money(d.netValue)} |`
    ),
    '',
    `**Total: ${money(total)}**`,
    ...(order.comment ? ['', '## Comment', '', order.comment.trim()] : []),
    ''
  ].join('\n')
}
