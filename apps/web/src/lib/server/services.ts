import { Redis } from 'ioredis'
import { createLogger } from '@lib/logging'
import { createServiceClient } from '@lib/trpc'
import type { AppRouter as CustomerRouter } from '@api/customer'
import type { AppRouter as DocumentRouter } from '@api/document'
import type { AppRouter as OrderRouter } from '@api/order'
import type { AppRouter as SystemRouter } from '@api/system'
import { getConfig } from './config'

const build = () => {
	const config = getConfig()

	const opts = (url: string) => ({
		url: `${url}/trpc`,
		serviceId: config.SERVICE_ID,
		timeoutMs: config.REQUEST_TIMEOUT_MS
	})

	return {
		config,
		log: createLogger({
			service: config.SERVICE_ID,
			level: config.LOG_LEVEL
		}),

		// Redis holds JWTs only (key prefix jwt:)
		redis: new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }),
		customer: createServiceClient<CustomerRouter>(opts(config.CUSTOMER_SERVICE_URL)),
		order: createServiceClient<OrderRouter>(opts(config.ORDER_SERVICE_URL)),
		document: createServiceClient<DocumentRouter>(opts(config.DOCUMENT_SERVICE_URL)),
		system: createServiceClient<SystemRouter>(opts(config.SYSTEM_SERVICE_URL))
	}
}

let services: ReturnType<typeof build> | undefined

export const getServices = () => (services ??= build())
