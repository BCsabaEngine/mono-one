import { z } from 'zod'
import { PERMISSIONS } from '@lib/permissions'
import { deletedSchema, id, idInput, idsInput } from '@lib/zod'

export { deletedSchema, PERMISSIONS }

export const permissionSchema = z.enum(PERMISSIONS)
export type Permission = z.infer<typeof permissionSchema>

/** Never carries the password or its hash. A soft-deleted user is still returned, with `deletedAt` set. */
export const userSchema = z.object({
  id,
  email: z.email(),
  name: z.string(),
  permissions: z.array(permissionSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable() // null = active (soft delete)
})
export type User = z.infer<typeof userSchema>

export const getUserInput = idInput
export const getUsersInput = idsInput
export const authUserInput = z.object({
  email: z.email(),
  password: z.string().min(1)
})
export type AuthUserInput = z.infer<typeof authUserInput>

export const addUserInput = z.object({
  email: z.email(),
  name: z.string().min(1),
  password: z.string().min(1),
  permissions: z.array(permissionSchema).default([])
})
export type AddUserInput = z.infer<typeof addUserInput>

export const updateUserInput = z.object({
  id,
  name: z.string().min(1).optional(),
  permissions: z.array(permissionSchema).optional(),
  password: z.string().min(1).optional()
})
export type UpdateUserInput = z.infer<typeof updateUserInput>

export const deleteUserInput = idInput

/** Port implemented by apps/system-service, consumed by the router in system-api. */
export interface UsersService {
  get(id: number): Promise<User>
  /** Unknown ids are omitted; the result follows the order of `ids`. */
  getMany(ids: number[]): Promise<User[]>
  /** The username is the email. Unknown, deleted and wrong-password all fail the same way (UNAUTHORIZED). */
  auth(input: AuthUserInput): Promise<User>
  add(input: AddUserInput): Promise<User>
  /** `permissions`, when given, replaces the whole set. */
  update(input: UpdateUserInput): Promise<User>
  /** Soft delete; idempotent. */
  delete(id: number): Promise<{ id: number }>
}
