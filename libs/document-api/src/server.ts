import { createTRPC, requireIdentity, type BaseContext } from '@mono/shared-trpc'
import { documentSchema, getDocumentInput, type DocumentsService } from '@mono/document-contract'

export interface DocumentContext extends BaseContext {
  services: { documents: DocumentsService }
}

const { router, procedure } = createTRPC<DocumentContext>()

export const appRouter = router({
  documents: router({
    get: procedure
      .input(getDocumentInput)
      .output(documentSchema)
      .query(({ input, ctx }) => (requireIdentity(ctx), ctx.services.documents.getByOrder(input.orderId)))
  })
})

export type AppRouter = typeof appRouter
