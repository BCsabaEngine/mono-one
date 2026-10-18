import { z } from 'zod'
import type { CallContext } from '@lib/trpc'

export const generateOrderDocumentInput = z.object({
  orderId: z.number().int().positive()
})
export type GenerateOrderDocumentInput = z.infer<
  typeof generateOrderDocumentInput
>

/** A generated file. Markdown today; PDF later (then `content` becomes base64, announced by a new `contentType`). */
export const generatedDocumentSchema = z.object({
  orderId: z.number().int().positive(),
  filename: z.string(),
  contentType: z.enum(['text/markdown']),
  content: z.string()
})
export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>

/** Port implemented by apps/document-service, consumed by the router in document-api. No storage: documents are rendered on demand. */
export interface DocumentsService {
  /** Reads the order (order-service) and its customer (customer-service) with the caller's identity and renders the order document. NOT_FOUND when the order or its customer is missing. */
  generateOrderDocument(
    orderId: number,
    caller: CallContext
  ): Promise<GeneratedDocument>
}
