import { describe, expect, it } from 'vitest'
import {
  generateOrderDocumentInput,
  generatedDocumentSchema
} from '@api/document'

const document = {
  orderId: 5,
  filename: 'order-5.md',
  contentType: 'text/markdown',
  content: '# Order 5'
}

describe('document contract', () => {
  describe('generateOrderDocumentInput', () => {
    it('accepts a positive integer order id', () => {
      expect(generateOrderDocumentInput.parse({ orderId: 5 })).toEqual({
        orderId: 5
      })
    })

    it.each([0, -1, 1.5, '1', null, undefined])('rejects orderId %j', value => {
      expect(
        generateOrderDocumentInput.safeParse({ orderId: value }).success
      ).toBe(false)
    })
  })

  describe('generatedDocumentSchema', () => {
    it('accepts a markdown document', () => {
      expect(generatedDocumentSchema.parse(document)).toEqual(document)
    })

    it('accepts empty content', () => {
      expect(
        generatedDocumentSchema.safeParse({ ...document, content: '' }).success
      ).toBe(true)
    })

    it('only knows the text/markdown content type', () => {
      expect(
        generatedDocumentSchema.safeParse({
          ...document,
          contentType: 'application/pdf'
        }).success
      ).toBe(false)
    })

    it('rejects a bad order id and a missing field', () => {
      expect(
        generatedDocumentSchema.safeParse({ ...document, orderId: 0 }).success
      ).toBe(false)
      expect(
        generatedDocumentSchema.safeParse({ ...document, filename: undefined })
          .success
      ).toBe(false)
    })
  })
})
