import { z } from 'zod'
import {
  callContextOf,
  checkedOutsideProduction,
  createTRPC,
  requireIdentity
} from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import {
  addOrderDetailInput,
  createOrderInput,
  deleteInput,
  deletedSchema,
  getOrderInput,
  listOrdersInput,
  orderDetailSchema,
  orderSchema
} from './contract'
import type { OrderDetailsService, OrdersService } from './contract'

export interface OrderContext extends BaseContext {
  services: { orders: OrdersService; orderDetails: OrderDetailsService }
}

const { router, procedure } = createTRPC<OrderContext>()

const authed = procedure.use(({ ctx, next }) => (requireIdentity(ctx), next()))

export const appRouter = router({
  orders: router({
    create: authed
      .input(createOrderInput)
      .output(orderSchema)
      .mutation(({ input, ctx }) =>
        ctx.services.orders.create(input, callContextOf(ctx))
      ),

    get: authed
      .input(getOrderInput)
      .output(checkedOutsideProduction(orderSchema))
      .query(({ input, ctx }) => ctx.services.orders.get(input.id)),

    list: authed
      .input(listOrdersInput)
      .output(checkedOutsideProduction(z.array(orderSchema)))
      .query(({ input, ctx }) => ctx.services.orders.list(input)),

    delete: authed
      .input(deleteInput)
      .output(deletedSchema)
      .mutation(({ input, ctx }) => ctx.services.orders.delete(input.id))
  }),

  orderDetails: router({
    add: authed
      .input(addOrderDetailInput)
      .output(orderDetailSchema)
      .mutation(({ input, ctx }) => ctx.services.orderDetails.add(input)),

    delete: authed
      .input(deleteInput)
      .output(deletedSchema)
      .mutation(({ input, ctx }) => ctx.services.orderDetails.delete(input.id))
  })
})

export type AppRouter = typeof appRouter
