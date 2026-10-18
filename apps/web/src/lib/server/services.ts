import { Redis } from 'ioredis'
import { createLogger } from '@mono/shared-logging'
import { createServiceClient } from '@mono/shared-trpc'
import type { AppRouter as CustomerRouter } from '@mono/customer-api'
import type { AppRouter as DocumentRouter } from '@mono/document-api'
import type { AppRouter as OrderRouter } from '@mono/order-api'
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
			level: config.LOG_LEVEL,
			pretty: config.NODE_ENV === 'development'
		}),
		// Redis holds JWTs only (key prefix jwt:)
		redis: new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }),
		customer: createServiceClient<CustomerRouter>(opts(config.CUSTOMER_SERVICE_URL)),
		order: createServiceClient<OrderRouter>(opts(config.ORDER_SERVICE_URL)),
		document: createServiceClient<DocumentRouter>(opts(config.DOCUMENT_SERVICE_URL))
	}
}

let services: ReturnType<typeof build> | undefined
export const getServices = () => (services ??= build())
