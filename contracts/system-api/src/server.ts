import { createTRPC, requireIdentity, requirePermission } from '@lib/trpc'
import type { BaseContext } from '@lib/trpc'
import {
  addUserInput,
  authUserInput,
  deletedSchema,
  deleteUserInput,
  getUserInput,
  getUsersInput,
  updateUserInput,
  userSchema
} from './contract'
import type { UsersService } from './contract'
import { z } from 'zod'

export interface SystemContext extends BaseContext {
  services: { users: UsersService }
}

const { router, procedure } = createTRPC<SystemContext>()

const authed = procedure.use(({ ctx, next }) => (requireIdentity(ctx), next()))

const admin = procedure.use(
  ({ ctx, next }) => (requirePermission(ctx, 'user.admin'), next())
)

export const appRouter = router({
  users: router({
    get: authed
      .input(getUserInput)
      .output(userSchema)
      .query(({ input, ctx }) => ctx.services.users.get(input.id)),

    getMany: authed
      .input(getUsersInput)
      .output(z.array(userSchema))
      .query(({ input, ctx }) => ctx.services.users.getMany(input.ids)),

    // the only call without an identity: it is how a user gets one (service-only, private network)
    auth: procedure
      .input(authUserInput)
      .output(userSchema)
      .mutation(({ input, ctx }) => ctx.services.users.auth(input)),

    add: admin
      .input(addUserInput)
      .output(userSchema)
      .mutation(({ input, ctx }) => ctx.services.users.add(input)),

    update: admin
      .input(updateUserInput)
      .output(userSchema)
      .mutation(({ input, ctx }) => ctx.services.users.update(input)),

    delete: admin
      .input(deleteUserInput)
      .output(deletedSchema)
      .mutation(({ input, ctx }) => ctx.services.users.delete(input.id))
  })
})

export type AppRouter = typeof appRouter
