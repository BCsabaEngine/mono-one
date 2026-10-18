import { randomUUID } from 'node:crypto'
import { getServices } from './services'

export const SESSION_COOKIE = 'sid'

const key = (sid: string) => `jwt:${sid}`

/** The BFF's only Redis use: JWT storage with a TTL matching the token lifetime. */
export const saveJwt = async (jwt: string) => {
	const { redis, config } = getServices()
	const sid = randomUUID()

	await redis.set(key(sid), jwt, 'EX', config.JWT_TTL_SECONDS)

	return sid
}

export const loadJwt = async (sid: string) => (await getServices().redis.get(key(sid))) ?? undefined
export const deleteJwt = async (sid: string) => void (await getServices().redis.del(key(sid)))
