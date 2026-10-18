import { callContextOf, createTRPC, requirePermission } from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import { generateOrderDocumentInput, generatedDocumentSchema } from './contract'
import type { DocumentsService } from './contract'

export interface DocumentContext extends BaseContext {
  services: { documents: DocumentsService }
}

const { router, procedure } = createTRPC<DocumentContext>()

const reader = procedure.use(
  ({ ctx, next }) => (requirePermission(ctx, 'document.read'), next())
)

export const appRouter = router({
  documents: router({
    generateOrderDocument: reader
      .input(generateOrderDocumentInput)
      .output(generatedDocumentSchema)
      .query(({ input, ctx }) =>
        ctx.services.documents.generateOrderDocument(
          input.orderId,
          callContextOf(ctx)
        )
      )
  })
})

export type AppRouter = typeof appRouter
