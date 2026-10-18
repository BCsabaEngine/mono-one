import { describe, expect, it } from 'vitest'
import { EVENTS, ownersDoNotSubscribe } from './registry'

describe('events registry', () => {
  it('never lists an owner among its own subscribers', () => {
    expect(ownersDoNotSubscribe).toBe(true)
    Object.values(EVENTS).forEach(def => expect(def.subscribers as readonly string[]).not.toContain(def.owner))
  })

  it('uses the owner-defined schema for validation', () => {
    expect(EVENTS['order.placed'].schema.safeParse({}).success).toBe(false)
  })
})
