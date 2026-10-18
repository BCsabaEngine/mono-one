import { asClass, asFunction, asValue, createContainer, InjectionMode } from 'awilix'
import { createDb } from '@mono/shared-db'
import type { Logger } from '@mono/shared-logging'
import { createServiceClient } from '@mono/shared-trpc'
import { createPublisher, serviceUrls } from '@mono/events-client'
import type { AppRouter as CustomerAppRouter } from '@mono/customer-api'
import type { Config } from './config'
import * as schema from './db/schema'
import { OrdersServiceImpl } from './services/orders'

export interface Cradle {
  config: Config
  log: Logger
  database: ReturnType<typeof createDb<typeof schema>>
  customerClient: ReturnType<typeof createServiceClient<CustomerAppRouter>>
  publisher: ReturnType<typeof createPublisher<'order-service'>>
  orders: OrdersServiceImpl
}

/** Root container; the pg pool is disposed through container.dispose() on shutdown. */
export const buildContainer = (config: Config, log: Logger) =>
  createContainer<Cradle>({ injectionMode: InjectionMode.PROXY }).register({
    config: asValue(config),
    log: asValue(log),
    database: asFunction(({ config, log }: Cradle) => createDb(config, log, schema))
      .singleton()
      .disposer(d => d.close()),
    customerClient: asFunction(({ config }: Cradle) =>
      createServiceClient<CustomerAppRouter>({
        url: `${config.CUSTOMER_SERVICE_URL}/trpc`,
        serviceId: config.SERVICE_ID,
        timeoutMs: config.REQUEST_TIMEOUT_MS
      })
    ).singleton(),
    publisher: asFunction(({ config, log }: Cradle) =>
      createPublisher({
        serviceId: 'order-service',
        urls: serviceUrls(config),
        log,
        timeoutMs: config.EVENT_TIMEOUT_MS
      })
    ).singleton(),
    orders: asClass(OrdersServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
