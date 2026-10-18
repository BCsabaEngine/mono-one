import { z } from 'zod'
import { defineEvent } from './contract'

/** Owned and sent only by order-service. */
export const orderPlaced = defineEvent(
  'order.placed',
  1,
  z.object({
    orderId: z.uuid(),
    customerId: z.number().int().positive(),
    totalCents: z.number().int().positive()
  })
)
