// Shared id scale for seed data: every entity type draws ids 1..100 from its own namespace,
// so a seeder can reference another service's rows without reading its database.
// Services with integer identities (customer, order, user) seed ids 1..100 directly instead; the scale still applies.
export const SEED_SCALE = { min: 1, max: 100 } as const

const PREFIX = { product: 3 } as const // one namespace per entity; add new entities here

export type SeedEntity = keyof typeof PREFIX

/** Deterministic UUID-shaped id, e.g. `seedId('product', 7)` = `00000003-0000-4000-8000-000000000007`. */
export const seedId = (entity: SeedEntity, n: number) =>
  `${String(PREFIX[entity]).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Every number on the scale, in order: 1..100. */
export const seedNumbers = () =>
  Array.from(
    { length: SEED_SCALE.max - SEED_SCALE.min + 1 },
    (_, i) => SEED_SCALE.min + i
  )

/** All ids of an entity on the scale, in order; index i belongs to `SEED_SCALE.min + i`. */
export const seedIds = (entity: SeedEntity) =>
  seedNumbers().map(n => seedId(entity, n))
