import type { Address, Contact } from '@api/customer'
import type { address, contact } from '../db/schema'

export const toStamps = (r: {
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}) => ({
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  deletedAt: r.deletedAt?.toISOString() ?? null
})

export const toAddress = (r: typeof address.$inferSelect): Address => ({
  ...r,
  ...toStamps(r)
})

export const toContact = (r: typeof contact.$inferSelect): Contact => ({
  ...r,
  ...toStamps(r)
})
