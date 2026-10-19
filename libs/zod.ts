import { z } from 'zod'
import { MAX_BATCH_IDS } from './constants'

/** Building blocks shared by every `*-api` contract. */
export const id = z.number().int().positive()
export const text = z.string().trim().min(1)

export const idInput = z.object({ id })
export const idsInput = z.object({ ids: z.array(id).min(1).max(MAX_BATCH_IDS) })
export const deletedSchema = idInput
