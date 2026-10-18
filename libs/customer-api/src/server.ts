import { createTRPC, requireIdentity, type BaseContext } from '@mono/shared-trpc'
import { customerSchema, getCustomerInput, type CustomersService } from '@mono/customer-contract'

export interface CustomerContext extends BaseContext {
  services: { customers: CustomersService }
}

const { router, procedure } = createTRPC<CustomerContext>()

export const appRouter = router({
  customers: router({
    get: procedure
      .input(getCustomerInput)
      .output(customerSchema)
      .query(({ input, ctx }) => (requireIdentity(ctx), ctx.services.customers.get(input.id)))
  })
})

export type AppRouter = typeof appRouter
