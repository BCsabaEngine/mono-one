import { z } from 'zod'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@lib/constants'
import { deletedSchema, id, idInput, text } from '@lib/zod'

export { deletedSchema, idInput as deleteInput }

// money is in minor units (e.g. cents); the caps keep quantity * unitPrice, summed over a whole order, a safe integer
const MAX_QUANTITY = 100_000
const MAX_UNIT_PRICE = 100_000_000
const MAX_DETAILS = 200

const quantity = z.number().int().positive().max(MAX_QUANTITY)
const unitPrice = z.number().int().positive().max(MAX_UNIT_PRICE)

const timestamps = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }

export const orderDetailSchema = z.object({
  id,
  orderId: id,
  productCode: z.string(),
  productName: z.string(),
  quantity,
  unitPrice,
  netValue: z.number().int().positive(), // quantity * unitPrice
  ...timestamps
})
export type OrderDetail = z.infer<typeof orderDetailSchema>

/** Only active (not soft-deleted) orders are returned. */
export const orderSchema = z.object({
  id,
  customerId: id,
  title: z.string(),
  comment: z.string().nullable(),
  deliveryAddressId: id, // an address of the customer, owned by customer-service
  details: z.array(orderDetailSchema),
  ...timestamps
})
export type Order = z.infer<typeof orderSchema>

const detailFields = {
  productCode: text,
  productName: text,
  quantity,
  unitPrice
}

export const createOrderInput = z.object({
  customerId: id,
  title: text,
  comment: text.nullish(),
  deliveryAddressId: id,
  details: z.array(z.object(detailFields)).min(1).max(MAX_DETAILS)
})
export type CreateOrderInput = z.infer<typeof createOrderInput>

export const listOrdersInput = z.object({
  customerId: id.optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.number().int().min(0).default(0)
})
export type ListOrdersInput = z.infer<typeof listOrdersInput>

export const addOrderDetailInput = z.object({ orderId: id, ...detailFields })
export type AddOrderDetailInput = z.infer<typeof addOrderDetailInput>

export const getOrderInput = idInput
export type GetOrderInput = z.infer<typeof getOrderInput>

/** Identity and correlation data the service forwards to other services (see `callContextOf`). */
export interface CallerInfo {
  jwt?: string
  traceId: string
  callChain: string[]
  userId?: string
}

/** Ports implemented by apps/order-service, consumed by the router in order-api. */
export interface OrdersService {
  /** Stores the order with its details in one transaction; the customer and the delivery address are checked in customer-service. */
  create(input: CreateOrderInput, caller: CallerInfo): Promise<Order>
  /** NOT_FOUND when the order does not exist or is deleted. */
  get(id: number): Promise<Order>
  /** Active orders with their details, newest first (two queries, no N+1). */
  list(input: ListOrdersInput): Promise<Order[]>
  /** Soft delete; idempotent. */
  delete(id: number): Promise<{ id: number }>
}

export interface OrderDetailsService {
  /** NOT_FOUND when the order does not exist or is deleted. */
  add(input: AddOrderDetailInput): Promise<OrderDetail>
  /** Hard delete; NOT_FOUND when the detail does not exist or its order is deleted. */
  delete(id: number): Promise<{ id: number }>
}
