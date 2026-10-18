import { createEventsRouter } from '@mono/events-client'
import type { DocumentsServiceImpl } from '../services/documents'

/** Exactly one handler per subscribed event type; the payload type comes from order-service's schema via the registry. */
export const buildEventsRouter = (documents: () => DocumentsServiceImpl) =>
  createEventsRouter('document-service', {
    'order.placed': event => documents().createForOrder(event.payload.orderId)
  })
