import type { IncomingHttpHeaders } from 'node:http'
import { asValue } from 'awilix'
import { baseContextFromHeaders } from '@mono/shared-trpc'
import type { CustomerContext } from '@mono/customer-api/server'
import type { Container, Cradle } from '../container'

/** One scoped Awilix container per request, carrying the request-ID child logger. */
export const createContext =
  (container: Container) =>
  (headers: IncomingHttpHeaders): CustomerContext => {
    const base = baseContextFromHeaders(headers, container.cradle.log)
    const scope = container.createScope<Cradle>().register({ log: asValue(base.log) })
    return { ...base, services: { customers: scope.cradle.customers } }
  }
