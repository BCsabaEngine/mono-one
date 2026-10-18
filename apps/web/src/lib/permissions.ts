export const can = (user: { permissions: string[] }, permission: string) => user.permissions.includes(permission)
