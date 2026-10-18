import type { OrderDetail } from '@api/order'
import type { orderDetail } from '../db/schema'

export const toStamps = (r: { createdAt: Date; updatedAt: Date }) => ({
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString()
})

export const toDetail = (r: typeof orderDetail.$inferSelect): OrderDetail => ({
  ...r,
  ...toStamps(r)
})
