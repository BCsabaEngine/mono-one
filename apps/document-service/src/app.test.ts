import { TRPCClientError } from '@trpc/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig, commonEnvSchema } from '@lib/config'
import { listen, silentLogger } from '@lib/testing'
import { createServiceClient, unsignedJwt } from '@lib/trpc'
import type { CallContext } from '@lib/trpc'
import type { AppRouter } from '@api/document'
import { createApp } from './app'
import type { Config } from './config'
import type { Dependencies } from './container'

const stamps = {
  createdAt: '2026-10-18T08:30:00.000Z',
  updatedAt: '2026-10-18T08:30:00.000Z'
}

const order = {
  id: 5,
  customerId: 7,
  title: 'Spring | delivery',
  comment: 'Ring twice',
  deliveryAddressId: 3,
  details: [
    {
      id: 1,
      orderId: 5,
      productCode: 'P-1',
      productName: 'Widget',
      quantity: 2,
      unitPrice: 500,
      netValue: 1000,
      ...stamps
    },
    {
      id: 2,
      orderId: 5,
      productCode: 'P-2',
      productName: 'Gadget | XL',
      quantity: 1,
      unitPrice: 990,
      netValue: 990,
      ...stamps
    }
  ],
  ...stamps
}

const customer = {
  id: 7,
  code: 'C-0007',
  name: 'Test Customer',
  address: {
    id: 3,
    customerId: 7,
    type: 'hq',
    name: null,
    country: 'HU',
    zip: '1051',
    city: 'Budapest',
    address: 'Fo utca 1',
    ...stamps,
    deletedAt: null
  }
}

const notFoundError = () =>
  Object.assign(new TRPCClientError('not found'), {
    data: { code: 'NOT_FOUND' }
  })

const seen: { orderId: number; context: unknown }[] = []
let current: typeof order | undefined = order

// order-service and customer-service are faked at the client boundary; their real calls are covered by their own tests
const orderClient = {
  orders: {
    get: {
      query: async ({ id }: { id: number }, opts: { context: unknown }) => (
        seen.push({ orderId: id, context: opts.context }),
        current && current.id === id ? current : Promise.reject(notFoundError())
      )
    }
  }
} as unknown as Dependencies['orderClient']

const customerClient = {
  customers: {
    summary: {
      query: async ({ id, addressId }: { id: number; addressId: number }) =>
        id === customer.id
          ? {
              ...customer,
              address:
                addressId === customer.address.id ? customer.address : null
            }
          : Promise.reject(notFoundError())
    }
  }
} as unknown as Dependencies['customerClient']

const config = loadConfig(commonEnvSchema, {
  SERVICE_ID: 'document-service',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent'
}) as Config

const jwt = unsignedJwt({ sub: 'user-1', permissions: ['document.read'] })
const reader = {
  context: {
    jwt,
    traceId: 'trace-abcdef',
    callChain: ['web']
  } satisfies CallContext
}

describe('document-service (no database)', () => {
  let app: ReturnType<typeof createApp>
  let baseUrl: string
  let client: ReturnType<typeof createServiceClient<AppRouter>>

  beforeAll(async () => {
    app = createApp(config, silentLogger, { orderClient, customerClient })

    baseUrl = await listen(app.server)

    client = createServiceClient<AppRouter>({
      url: `${baseUrl}/trpc`,
      serviceId: 'test',
      timeoutMs: 5000
    })
  })

  afterAll(async () => {
    app.server.close()
    await app.container.dispose()
  })

  it('renders the order and its customer as a markdown file', async () => {
    const doc = await client.documents.generateOrderDocument.query(
      { orderId: order.id },
      reader
    )

    expect(doc).toMatchObject({
      orderId: 5,
      filename: 'order-5.md',
      contentType: 'text/markdown'
    })
    expect(doc.content).toBe(
      [
        '# Order 5: Spring \\| delivery',
        '',
        'Date: 2026-10-18',
        '',
        '## Customer',
        '',
        'Test Customer (C-0007)',
        '',
        '## Delivery address',
        '',
        'Fo utca 1, 1051 Budapest, HU',
        '',
        '## Items',
        '',
        '| Code | Product | Quantity | Unit price | Net value |',
        '| --- | --- | ---: | ---: | ---: |',
        '| P-1 | Widget | 2 | 5.00 | 10.00 |',
        '| P-2 | Gadget \\| XL | 1 | 9.90 | 9.90 |',
        '',
        '**Total: 19.90**',
        '',
        '## Comment',
        '',
        'Ring twice',
        ''
      ].join('\n')
    )
  })

  it('forwards the JWT, trace id and call chain to the order service', async () => {
    seen.length = 0

    await client.documents.generateOrderDocument.query({ orderId: 5 }, reader)

    expect(seen).toEqual([
      {
        orderId: 5,
        context: {
          jwt,
          traceId: 'trace-abcdef',
          callChain: ['web', 'document-service'],
          userId: 'user-1'
        }
      }
    ])
  })

  it('names an address that is no longer active instead of failing', async () => {
    current = { ...order, deliveryAddressId: 99 }

    try {
      const doc = await client.documents.generateOrderDocument.query(
        { orderId: 5 },
        reader
      )
      expect(doc.content).toContain('Address 99 (no longer available)')
    } finally {
      current = order
    }
  })

  it('answers NOT_FOUND when the order or its customer is missing', async () => {
    await expect(
      client.documents.generateOrderDocument.query({ orderId: 404 }, reader)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })

    current = { ...order, customerId: 404 }

    try {
      await expect(
        client.documents.generateOrderDocument.query({ orderId: 5 }, reader)
      ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    } finally {
      current = order
    }
  })

  it('needs an identity with the document.read permission', async () => {
    await expect(
      client.documents.generateOrderDocument.query({ orderId: 5 })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })

    await expect(
      client.documents.generateOrderDocument.query(
        { orderId: 5 },
        { context: { jwt: unsignedJwt({ sub: 'user-2' }) } }
      )
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })
  })

  it('is ready without a database', async () => {
    expect((await fetch(`${baseUrl}/readyz`)).status).toBe(200)
  })
})
