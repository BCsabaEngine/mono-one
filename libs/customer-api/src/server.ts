import { z } from 'zod'
import {
  checkedOutsideProduction,
  createTRPC,
  requireIdentity,
  requirePermission
} from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import {
  addAddressInput,
  addressBelongsInput,
  addressBelongsSchema,
  addContactInput,
  addCustomerInput,
  addressSchema,
  contactSchema,
  customerSchema,
  customerSummaryInput,
  customerSummarySchema,
  deleteInput,
  deletedSchema,
  getCustomerInput,
  listCustomersInput,
  updateAddressInput,
  updateContactInput,
  updateCustomerInput
} from './contract'
import type {
  AddressesService,
  ContactsService,
  CustomersService
} from './contract'

export interface CustomerContext extends BaseContext {
  services: {
    customers: CustomersService
    addresses: AddressesService
    contacts: ContactsService
  }
}

const { router, procedure } = createTRPC<CustomerContext>()

const authed = procedure.use(({ ctx, next }) => (requireIdentity(ctx), next()))

const admin = procedure.use(
  ({ ctx, next }) => (requirePermission(ctx, 'customer.admin'), next())
)

export const appRouter = router({
  customers: router({
    get: authed
      .input(getCustomerInput)
      .output(checkedOutsideProduction(customerSchema))
      .query(({ input, ctx }) => ctx.services.customers.get(input.id)),

    list: authed
      .input(listCustomersInput)
      .output(checkedOutsideProduction(z.array(customerSchema)))
      .query(({ input, ctx }) => ctx.services.customers.list(input.ids)),

    summary: authed
      .input(customerSummaryInput)
      .output(customerSummarySchema)
      .query(({ input, ctx }) => ctx.services.customers.summary(input)),

    add: admin
      .input(addCustomerInput)
      .output(customerSchema)
      .mutation(({ input, ctx }) => ctx.services.customers.add(input)),

    update: admin
      .input(updateCustomerInput)
      .output(customerSchema)
      .mutation(({ input, ctx }) => ctx.services.customers.update(input)),

    delete: admin
      .input(deleteInput)
      .output(deletedSchema)
      .mutation(({ input, ctx }) => ctx.services.customers.delete(input.id))
  }),

  addresses: router({
    belongsTo: authed
      .input(addressBelongsInput)
      .output(addressBelongsSchema)
      .query(({ input, ctx }) => ctx.services.addresses.belongsTo(input)),

    add: admin
      .input(addAddressInput)
      .output(addressSchema)
      .mutation(({ input, ctx }) => ctx.services.addresses.add(input)),

    update: admin
      .input(updateAddressInput)
      .output(addressSchema)
      .mutation(({ input, ctx }) => ctx.services.addresses.update(input)),

    delete: admin
      .input(deleteInput)
      .output(deletedSchema)
      .mutation(({ input, ctx }) => ctx.services.addresses.delete(input.id))
  }),

  contacts: router({
    add: admin
      .input(addContactInput)
      .output(contactSchema)
      .mutation(({ input, ctx }) => ctx.services.contacts.add(input)),

    update: admin
      .input(updateContactInput)
      .output(contactSchema)
      .mutation(({ input, ctx }) => ctx.services.contacts.update(input)),

    delete: admin
      .input(deleteInput)
      .output(deletedSchema)
      .mutation(({ input, ctx }) => ctx.services.contacts.delete(input.id))
  })
})

export type AppRouter = typeof appRouter
