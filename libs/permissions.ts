// kept free of imports: the system-service Drizzle schema loads this file by relative path (drizzle-kit ignores tsconfig paths)
/** Flat permission names; a code-only list (stored as text, no database enum type). */
export const PERMISSIONS = [
  'user.admin',
  'customer.read',
  'customer.admin',
  'order.place',
  'document.read'
] as const
export type PermissionName = (typeof PERMISSIONS)[number]
