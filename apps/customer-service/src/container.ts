import {
  asClass,
  asFunction,
  asValue,
  createContainer,
  InjectionMode
} from 'awilix'
import { createDb } from '@lib/db'
import type { Logger } from '@lib/logging'
import type { Config } from './config'
import * as schema from './db/schema'
import { CustomersServiceImpl } from './services/customers'

export interface Dependencies {
  config: Config
  log: Logger
  database: ReturnType<typeof createDb<typeof schema>>
  customers: CustomersServiceImpl
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
    customers: asClass(CustomersServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
