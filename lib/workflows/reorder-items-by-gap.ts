/**
 * Moves one item to a gap index (0 = before first item, `items.length` = after last).
 */
export function reorderItemsByGapIndex<T extends { id: string }>({
  items,
  activeId,
  gapIndex,
}: {
  items: T[]
  activeId: string
  gapIndex: number
}): T[] {
  const n = items.length
  if (n <= 1) return items
  const fromIdx = items.findIndex((b) => b.id === activeId)
  if (fromIdx === -1) return items
  const clampedGap = Math.max(0, Math.min(gapIndex, n))

  const next = [...items]
  const [moved] = next.splice(fromIdx, 1)
  if (!moved) return items

  let insertAt = clampedGap
  if (fromIdx < clampedGap) insertAt -= 1
  insertAt = Math.max(0, Math.min(insertAt, next.length))
  next.splice(insertAt, 0, moved)
  return next
}
