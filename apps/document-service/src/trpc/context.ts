import type { IncomingHttpHeaders } from 'node:http'
import { asValue } from 'awilix'
import { baseContextFromHeaders } from '@lib/trpc'
import type { DocumentContext } from '@api/document'
import type { Container, Dependencies } from '../container'

/** One scoped Awilix container per request, carrying the trace child logger (traceId, callChain, userId). */
export const createContext =
  (container: Container) =>
  (headers: IncomingHttpHeaders): DocumentContext => {
    const base = baseContextFromHeaders(
      headers,
      container.cradle.log,
      container.cradle.config.SERVICE_ID
    )
    const scope = container
      .createScope<Dependencies>()
      .register({ log: asValue(base.log) })
    return { ...base, services: { documents: scope.cradle.documents } }
  }
