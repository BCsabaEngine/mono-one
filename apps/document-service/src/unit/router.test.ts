import { describe, expect, it, vi } from 'vitest'
import { notFound } from '@lib/errors'
import { silentLogger } from '@lib/testing'
import { appRouter } from '@api/document'
import type { DocumentContext } from '@api/document'

const documentDto = {
  orderId: 5,
  filename: 'order-5.md',
  contentType: 'text/markdown',
  content: '# Order 5'
}

const makeServices = () => ({
  documents: { generateOrderDocument: vi.fn(async () => documentDto) }
})

type Services = ReturnType<typeof makeServices>

const callerFor = (
  services: Services,
  permissions?: string[], // undefined = no identity
  extra: { userId?: string; jwt?: string } = {}
) =>
  appRouter.createCaller({
    log: silentLogger,
    traceId: 'trace-0001',
    callChain: ['web', 'document-service'],
    ...extra,
    ...(permissions && { identity: { sub: '1', roles: [], permissions } }),
    services: services as unknown as DocumentContext['services']
  })

describe('document router', () => {
  describe('authorization', () => {
    it('is UNAUTHORIZED without identity', async () => {
      const services = makeServices()

      await expect(
        callerFor(services).documents.generateOrderDocument({ orderId: 5 })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      expect(services.documents.generateOrderDocument).not.toHaveBeenCalled()
    })

    it.each([[[]], [['order.place']], [['customer.admin', 'user.admin']]])(
      'is FORBIDDEN with the permissions %j',
      async permissions => {
        const services = makeServices()

        await expect(
          callerFor(services, permissions).documents.generateOrderDocument({
            orderId: 5
          })
        ).rejects.toMatchObject({
          code: 'FORBIDDEN',
          message: 'Missing permission document.read'
        })
        expect(services.documents.generateOrderDocument).not.toHaveBeenCalled()
      }
    )

    it('is allowed with document.read', async () => {
      const services = makeServices()

      await expect(
        callerFor(services, ['document.read']).documents.generateOrderDocument({
          orderId: 5
        })
      ).resolves.toEqual(documentDto)
    })
  })

  describe('delegation', () => {
    it('passes the order id and the caller context (trace, chain, user, token)', async () => {
      const services = makeServices()
      const caller = callerFor(services, ['document.read'], {
        userId: '1',
        jwt: 'a.b.c'
      })

      await caller.documents.generateOrderDocument({ orderId: 5 })

      expect(services.documents.generateOrderDocument).toHaveBeenCalledWith(5, {
        traceId: 'trace-0001',
        callChain: ['web', 'document-service'],
        userId: '1',
        jwt: 'a.b.c'
      })
    })

    it('leaves userId and jwt out when the context has none', async () => {
      const services = makeServices()

      await callerFor(services, [
        'document.read'
      ]).documents.generateOrderDocument({ orderId: 5 })

      expect(services.documents.generateOrderDocument).toHaveBeenCalledWith(5, {
        traceId: 'trace-0001',
        callChain: ['web', 'document-service']
      })
    })
  })

  describe('input and output validation', () => {
    it.each([0, -1, 1.5])(
      'rejects orderId %j as BAD_REQUEST',
      async orderId => {
        const services = makeServices()

        await expect(
          callerFor(services, [
            'document.read'
          ]).documents.generateOrderDocument({
            orderId
          })
        ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
        expect(services.documents.generateOrderDocument).not.toHaveBeenCalled()
      }
    )

    it('rejects a service result that does not match the output schema', async () => {
      const services = makeServices()
      services.documents.generateOrderDocument.mockResolvedValueOnce({
        ...documentDto,
        contentType: 'application/pdf'
      })

      await expect(
        callerFor(services, ['document.read']).documents.generateOrderDocument({
          orderId: 5
        })
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
    })
  })

  describe('errors', () => {
    it('maps a domain NOT_FOUND from the service', async () => {
      const services = makeServices()
      services.documents.generateOrderDocument.mockRejectedValueOnce(
        notFound('Order', '9')
      )

      await expect(
        callerFor(services, ['document.read']).documents.generateOrderDocument({
          orderId: 9
        })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Order 9 not found'
      })
    })

    it('masks an unknown error as INTERNAL_SERVER_ERROR', async () => {
      const services = makeServices()
      services.documents.generateOrderDocument.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 10.0.0.5:3002')
      )

      await expect(
        callerFor(services, ['document.read']).documents.generateOrderDocument({
          orderId: 5
        })
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal error'
      })
    })
  })
})
