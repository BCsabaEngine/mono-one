import { toStamps } from '@lib/stamps'
import type { Address, Contact } from '@api/customer'
import type { address, contact } from '../db/schema'

export { toStamps }

export const toAddress = (r: typeof address.$inferSelect): Address => ({
  ...r,
  ...toStamps(r)
})

export const toContact = (r: typeof contact.$inferSelect): Contact => ({
  ...r,
  ...toStamps(r)
})
