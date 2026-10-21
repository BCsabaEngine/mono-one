import { asClass, asFunction, createContainer, InjectionMode } from 'awilix'
import type { Db } from '@lib/db'
import type { Logger } from '@lib/logging'
import {
  baseRegistrations,
  databaseRegistration,
  serviceClientRegistration
} from '@lib/trpc'
import type { createServiceClient } from '@lib/trpc'
import { createPublisher, serviceUrls } from '@events/client'
import type { AppRouter as CustomerAppRouter } from '@api/customer'
import type { Config } from './config'
import * as schema from './db/schema'
import { OrderDetailsServiceImpl } from './services/orderDetails'
import { OrdersServiceImpl } from './services/orders'

export interface Dependencies {
  config: Config
  log: Logger
  database: Db<typeof schema>
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
    ...baseRegistrations(config, log),
    database: databaseRegistration(schema),
    customerClient: serviceClientRegistration<CustomerAppRouter>(
      'CUSTOMER_SERVICE_URL'
    ),
    publisher: asFunction(({ config, log }: Dependencies) =>
      createPublisher({
        serviceId: 'order-service',
        urls: serviceUrls(config),
        log,
        timeoutMs: config.EVENT_TIMEOUT_MS
      })
    )
      .singleton()
      .disposer(p => p.drain()),
    orders: asClass(OrdersServiceImpl).scoped(),
    orderDetails: asClass(OrderDetailsServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
