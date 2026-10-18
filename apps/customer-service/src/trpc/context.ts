import type { IncomingHttpHeaders } from 'node:http'
import { asValue } from 'awilix'
import { baseContextFromHeaders } from '@lib/trpc'
import type { CustomerContext } from '@api/customer'
import type { Container, Dependencies } from '../container'

/** One scoped Awilix container per request, carrying the trace child logger (traceId, callChain, userId). */
export const createContext =
  (container: Container) =>
  (headers: IncomingHttpHeaders): CustomerContext => {
    const base = baseContextFromHeaders(
      headers,
      container.cradle.log,
      container.cradle.config.SERVICE_ID
    )

    const scope = container
      .createScope<Dependencies>()
      .register({ log: asValue(base.log) })

    const { customers, addresses, contacts } = scope.cradle
    return { ...base, services: { customers, addresses, contacts } }
  }
