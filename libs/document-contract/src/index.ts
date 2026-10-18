import { z } from 'zod'

export const documentSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  kind: z.enum(['order-confirmation']),
  status: z.enum(['generated']),
  createdAt: z.iso.datetime()
})
export type Document = z.infer<typeof documentSchema>

export const getDocumentInput = z.object({ orderId: z.uuid() })
export type GetDocumentInput = z.infer<typeof getDocumentInput>

/** Port implemented by apps/document-service, consumed by the router in document-api. */
export interface DocumentsService {
  getByOrder(orderId: string): Promise<Document>
}
