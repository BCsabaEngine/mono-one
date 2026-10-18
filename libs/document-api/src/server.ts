import { createTRPC, requireIdentity } from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import { documentSchema, getDocumentInput } from './contract'
import type { DocumentsService } from './contract'

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
