import type { IncomingHttpHeaders } from 'node:http'
import { scopedContext } from '@lib/trpc'
import type { CustomerContext } from '@api/customer'
import type { Container, Dependencies } from '../container'

/** One scoped Awilix container per request, carrying the trace child logger (traceId, callChain, userId). */
export const createContext =
  (container: Container) =>
  (headers: IncomingHttpHeaders): CustomerContext => {
    const { base, services } = scopedContext<Dependencies>(container, headers)
    const { customers, addresses, contacts } = services

    return { ...base, services: { customers, addresses, contacts } }
  }
