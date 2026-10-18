import { z } from 'zod'

export const orderSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  customerName: z.string(),
  totalCents: z.number().int().positive(),
  status: z.enum(['placed']),
  createdAt: z.iso.datetime()
})
export type Order = z.infer<typeof orderSchema>

export const placeOrderInput = z.object({
  customerId: z.uuid(),
  totalCents: z.number().int().positive()
})
export type PlaceOrderInput = z.infer<typeof placeOrderInput>

/** Identity and correlation data the service forwards to other services (see `callContextOf`). */
export interface CallerInfo {
  jwt?: string
  traceId: string
  callChain: string[]
  userId?: string
}

/** Port implemented by apps/order-service, consumed by the router in order-api. */
export interface OrdersService {
  place(input: PlaceOrderInput, caller: CallerInfo): Promise<Order>
}
