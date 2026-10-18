import { asClass, asFunction, asValue, createContainer, InjectionMode } from 'awilix'
import { createDb } from '@mono/shared-db'
import type { Logger } from '@mono/shared-logging'
import type { Config } from './config'
import * as schema from './db/schema'
import { DocumentsServiceImpl } from './services/documents'

export interface Cradle {
  config: Config
  log: Logger
  database: ReturnType<typeof createDb<typeof schema>>
  documents: DocumentsServiceImpl
}

/** Root container; the pg pool is disposed through container.dispose() on shutdown. */
export const buildContainer = (config: Config, log: Logger) =>
  createContainer<Cradle>({ injectionMode: InjectionMode.PROXY }).register({
    config: asValue(config),
    log: asValue(log),
    database: asFunction(({ config, log }: Cradle) => createDb(config, log, schema))
      .singleton()
      .disposer(d => d.close()),
    documents: asClass(DocumentsServiceImpl).scoped()
  })

export type Container = ReturnType<typeof buildContainer>
