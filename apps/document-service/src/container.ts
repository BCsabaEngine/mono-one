import {
  asClass,
  asFunction,
  asValue,
  createContainer,
  InjectionMode
} from 'awilix'
import type { Logger } from '@lib/logging'
import { createServiceClient } from '@lib/trpc'
import type { AppRouter as CustomerAppRouter } from '@api/customer'
import type { AppRouter as OrderAppRouter } from '@api/order'
import type { Config } from './config'
import { DocumentsServiceImpl } from './services/documents'

export interface Dependencies {
  config: Config
  log: Logger
  orderClient: ReturnType<typeof createServiceClient<OrderAppRouter>>
  customerClient: ReturnType<typeof createServiceClient<CustomerAppRouter>>
  documents: DocumentsServiceImpl
}

export const buildContainer = (config: Config, log: Logger) =>
  createContainer<Dependencies>({
    injectionMode: InjectionMode.PROXY
  }).register({
    config: asValue(config),
    log: asValue(log),
    orderClient: asFunction(({ config }: Dependencies) =>
      createServiceClient<OrderAppRouter>({
        url: `${config.ORDER_SERVICE_URL}/trpc`,
        serviceId: config.SERVICE_ID,
        timeoutMs: config.REQUEST_TIMEOUT_MS
      })
    ).singleton(),
    customerClient: asFunction(({ config }: Dependencies) =>
      createServiceClient<CustomerAppRouter>({
        url: `${config.CUSTOMER_SERVICE_URL}/trpc`,
        serviceId: config.SERVICE_ID,
        timeoutMs: config.REQUEST_TIMEOUT_MS
      })
    ).singleton(),
    documents: asClass(DocumentsServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
