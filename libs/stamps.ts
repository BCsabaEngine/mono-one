type Stamped = { createdAt: Date; updatedAt: Date }
type Stamps = { createdAt: string; updatedAt: string }

/** Business timestamps of a row (see `businessColumns`) as ISO strings; `deletedAt` only when the row has one. */
export function toStamps(
  r: Stamped & { deletedAt: Date | null }
): Stamps & { deletedAt: string | null }
export function toStamps(r: Stamped): Stamps
export function toStamps(r: Stamped & { deletedAt?: Date | null }) {
  return {
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...('deletedAt' in r && { deletedAt: r.deletedAt?.toISOString() ?? null })
  }
}

/** The rows of `ids` in that order; unknown ids are omitted. */
export const inIdOrder = <T extends { id: number }>(
  ids: number[],
  rows: T[]
) => {
  const byId = new Map(rows.map(r => [r.id, r]))

  return ids.flatMap(id => byId.get(id) ?? [])
}
