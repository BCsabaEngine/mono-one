import { decodeJwt } from '@lib/trpc'
import type { LayoutServerLoad } from './$types'

// the identity shown in the UI comes from the session JWT claims (decoded, not verified; the core services authorize with the same claims)
export const load: LayoutServerLoad = ({ locals }) => {
	const identity = locals.jwt ? decodeJwt(locals.jwt) : undefined
	if (!identity) return { user: null }

	return {
		user: {
			id: identity.sub,
			name: String(identity.name ?? identity.email ?? 'User'),
			email: String(identity.email ?? ''),
			permissions: identity.permissions
		}
	}
}
