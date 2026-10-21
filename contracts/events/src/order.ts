import { z } from 'zod'
import { id } from '@lib/zod'
import { defineEvent } from './contract'

/** Owned and sent only by order-service. */
export const orderPlaced = defineEvent(
  'order.placed',
  1,
  z.object({
    orderId: id,
    customerId: id,
    totalCents: z.number().int().positive()
  })
)
