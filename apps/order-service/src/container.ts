import {
  asClass,
  asFunction,
  asValue,
  createContainer,
  InjectionMode
} from 'awilix'
import { createDb } from '@lib/db'
import type { Logger } from '@lib/logging'
import { createServiceClient } from '@lib/trpc'
import { createPublisher, serviceUrls } from '@events/client'
import type { AppRouter as CustomerAppRouter } from '@api/customer'
import type { Config } from './config'
import * as schema from './db/schema'
import { OrderDetailsServiceImpl } from './services/orderDetails'
import { OrdersServiceImpl } from './services/orders'

export interface Dependencies {
  config: Config
  log: Logger
  database: ReturnType<typeof createDb<typeof schema>>
  customerClient: ReturnType<typeof createServiceClient<CustomerAppRouter>>
  publisher: ReturnType<typeof createPublisher<'order-service'>>
  orders: OrdersServiceImpl
  orderDetails: OrderDetailsServiceImpl
}

/** Root container; the pg pool is disposed through container.dispose() on shutdown. */
export const buildContainer = (config: Config, log: Logger) =>
  createContainer<Dependencies>({
    injectionMode: InjectionMode.PROXY
  }).register({
    config: asValue(config),
    log: asValue(log),
    database: asFunction(({ config, log }: Dependencies) =>
      createDb(config, log, schema)
    )
      .singleton()
      .disposer(d => d.close()),
    customerClient: asFunction(({ config }: Dependencies) =>
      createServiceClient<CustomerAppRouter>({
        url: `${config.CUSTOMER_SERVICE_URL}/trpc`,
        serviceId: config.SERVICE_ID,
        timeoutMs: config.REQUEST_TIMEOUT_MS
      })
    ).singleton(),
    publisher: asFunction(({ config, log }: Dependencies) =>
      createPublisher({
        serviceId: 'order-service',
        urls: serviceUrls(config),
        log,
        timeoutMs: config.EVENT_TIMEOUT_MS
      })
    ).singleton(),
    orders: asClass(OrdersServiceImpl).scoped(),
    orderDetails: asClass(OrderDetailsServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
