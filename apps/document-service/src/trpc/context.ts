import type { IncomingHttpHeaders } from 'node:http'
import { scopedContext } from '@lib/trpc'
import type { DocumentContext } from '@api/document'
import type { Container, Dependencies } from '../container'

/** One scoped Awilix container per request, carrying the trace child logger (traceId, callChain, userId). */
export const createContext =
  (container: Container) =>
  (headers: IncomingHttpHeaders): DocumentContext => {
    const { base, services } = scopedContext<Dependencies>(container, headers)

    return { ...base, services: { documents: services.documents } }
  }
