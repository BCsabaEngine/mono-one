import type { IncomingHttpHeaders } from 'node:http'
import { scopedContext } from '@lib/trpc'
import type { OrderContext } from '@api/order'
import type { Container, Dependencies } from '../container'

/** One scoped Awilix container per request, carrying the trace child logger (traceId, callChain, userId). */
export const createContext =
  (container: Container) =>
  (headers: IncomingHttpHeaders): OrderContext => {
    const { base, services } = scopedContext<Dependencies>(container, headers)
    const { orders, orderDetails } = services

    return { ...base, services: { orders, orderDetails } }
  }
