import { toStamps } from '@lib/stamps'
import type { OrderDetail } from '@api/order'
import type { orderDetail } from '../db/schema'

export { toStamps }

export const toDetail = (r: typeof orderDetail.$inferSelect): OrderDetail => ({
  ...r,
  ...toStamps(r)
})
