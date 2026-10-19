import { asClass, createContainer, InjectionMode } from 'awilix'
import type { Logger } from '@lib/logging'
import { baseRegistrations, serviceClientRegistration } from '@lib/trpc'
import type { createServiceClient } from '@lib/trpc'
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

/** Root container; no database, so nothing to dispose but the clients. */
export const buildContainer = (config: Config, log: Logger) =>
  createContainer<Dependencies>({
    injectionMode: InjectionMode.PROXY
  }).register({
    ...baseRegistrations(config, log),
    orderClient: serviceClientRegistration<OrderAppRouter>('ORDER_SERVICE_URL'),
    customerClient: serviceClientRegistration<CustomerAppRouter>(
      'CUSTOMER_SERVICE_URL'
    ),
    documents: asClass(DocumentsServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
