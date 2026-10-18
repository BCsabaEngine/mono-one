import { createTRPC, requireIdentity } from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import { orderSchema, placeOrderInput } from './contract'
import type { OrdersService } from './contract'

export interface OrderContext extends BaseContext {
  services: { orders: OrdersService }
}

const { router, procedure } = createTRPC<OrderContext>()

export const appRouter = router({
  orders: router({
    place: procedure
      .input(placeOrderInput)
      .output(orderSchema)
      .mutation(
        ({ input, ctx }) => (
          requireIdentity(ctx),
          ctx.services.orders.place(input, { requestId: ctx.requestId, ...(ctx.jwt && { jwt: ctx.jwt }) })
        )
      )
  })
})

export type AppRouter = typeof appRouter
