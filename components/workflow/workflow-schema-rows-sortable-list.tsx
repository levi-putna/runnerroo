"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"
import { reorderItemsByGapIndex } from "@/lib/workflows/reorder-items-by-gap"

/** Total vertical slot for drop marker: 6px + 2px stroke + 6px */
const GAP_SLOT_PX = 14

function gapCentresFromRowElements(orderedIds: string[], elById: Map<string, HTMLElement>): number[] {
  const rects: DOMRect[] = []
  for (const id of orderedIds) {
    const el = elById.get(id)
    if (!el) continue
    rects.push(el.getBoundingClientRect())
  }
  if (rects.length === 0) return []

  const centres: number[] = []
  centres.push(rects[0]!.top - GAP_SLOT_PX / 2)
  for (let i = 0; i < rects.length - 1; i++) {
    centres.push((rects[i]!.bottom + rects[i + 1]!.top) / 2)
  }
  centres.push(rects[rects.length - 1]!.bottom + GAP_SLOT_PX / 2)
  return centres
}

function nearestGapIndex(pointerY: number, centres: number[]): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < centres.length; i++) {
    const d = Math.abs(pointerY - centres[i]!)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

interface GapIndicatorSlotProps {
  gapIndex: number
  highlightedGapIndex: number | null
  isDragging: boolean
}

/**
 * Insertion gutter between rows — only occupies vertical space while dragging when this gap is active.
 */
function GapIndicatorSlot({ gapIndex, highlightedGapIndex, isDragging }: GapIndicatorSlotProps) {
  const show = isDragging && highlightedGapIndex === gapIndex

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden transition-[height] duration-150 ease-out",
        show ? "h-[14px]" : "h-0",
      )}
      aria-hidden
    >
      {show ? (
        // Horizontal inset keeps the stroke clear of rounded row corners
        <div className="flex h-[14px] items-center px-[3px]">
          <div className="h-0.5 w-full shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_1px_hsl(var(--background)/80%)] dark:bg-blue-400" />
        </div>
      ) : null}
    </div>
  )
}

export type WorkflowSchemaRowsSortableRenderContext<T extends { id: string }> = {
  item: T
  index: number
  /** Margin below the row when another item follows — preserves spacing while gap slots stay height 0 */
  spacingBelow: boolean
  isDragging: boolean
  sortableStyle: React.CSSProperties
  mergedSortableRef: (element: HTMLElement | null) => void
  setActivatorNodeRef: (element: HTMLElement | null) => void
  dragAttributes: DraggableAttributes
  dragListeners: DraggableSyntheticListeners | undefined
}

export type WorkflowSchemaRowsSortableListProps<T extends { id: string }> = {
  items: T[]
  onReorder: ({ next }: { next: T[] }) => void
  renderRow: (ctx: WorkflowSchemaRowsSortableRenderContext<T>) => React.ReactNode
  renderDragOverlay?: ({ item }: { item: T }) => React.ReactNode
}

export type WorkflowSchemaSortableGripProps = {
  setActivatorNodeRef: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners | undefined
  /** Accessible name for the grip control */
  ariaLabel?: string
}

/**
 * Grip-only drag activator matching Switch case rows and other schema lists.
 */
export function WorkflowSchemaSortableGrip({
  setActivatorNodeRef,
  attributes,
  listeners,
  ariaLabel = "Drag to reorder",
}: WorkflowSchemaSortableGripProps) {
  return (
    <div
      ref={setActivatorNodeRef}
      className={cn(
        "flex w-8 shrink-0 touch-none select-none items-center justify-center self-stretch bg-transparent p-0 outline-none",
        "border-0 text-muted-foreground hover:text-foreground",
        "cursor-grab hover:cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-0",
      )}
      aria-label={ariaLabel}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="pointer-events-none size-4 shrink-0" aria-hidden />
    </div>
  )
}

interface SortableSchemaRowProps<T extends { id: string }> {
  item: T
  index: number
  itemCount: number
  registerRowElement: ({ id, el }: { id: string; el: HTMLElement | null }) => void
  renderRow: (ctx: WorkflowSchemaRowsSortableRenderContext<T>) => React.ReactNode
}

/**
 * One sortable row — wires {@link useSortable} and forwards refs for gap snapping.
 */
function SortableSchemaRow<T extends { id: string }>({
  item,
  index,
  itemCount,
  registerRowElement,
  renderRow,
}: SortableSchemaRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    animateLayoutChanges: () => false,
  })

  const mergedSortableRef = React.useCallback(
    (el: HTMLElement | null) => {
      setNodeRef(el)
      registerRowElement({ id: item.id, el })
    },
    [item.id, registerRowElement, setNodeRef],
  )

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return renderRow({
    item,
    index,
    spacingBelow: index < itemCount - 1,
    isDragging,
    sortableStyle,
    mergedSortableRef,
    setActivatorNodeRef,
    dragAttributes: attributes,
    dragListeners: listeners,
  })
}

/**
 * Vertical schema-style list with @dnd-kit sorting — drop zones sit **between** rows (blue bar + padding).
 */
export function WorkflowSchemaRowsSortableList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
  renderDragOverlay,
}: WorkflowSchemaRowsSortableListProps<T>) {
  const rowElRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const gapIndexRef = React.useRef<number | null>(null)
  const dragUsedPointerRef = React.useRef(false)

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [highlightedGapIndex, setHighlightedGapIndex] = React.useState<number | null>(null)

  const registerRowElement = React.useCallback(({ id, el }: { id: string; el: HTMLElement | null }) => {
    if (!el) rowElRef.current.delete(id)
    else rowElRef.current.set(id, el)
  }, [])

  const ids = React.useMemo(() => items.map((i) => i.id), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const activeItem = activeId !== null ? (items.find((i) => i.id === activeId) ?? null) : null

  const syncGapFromPointerY = React.useCallback(
    (clientY: number) => {
      const centres = gapCentresFromRowElements(ids, rowElRef.current)
      if (centres.length === 0) return
      const idx = nearestGapIndex(clientY, centres)
      gapIndexRef.current = idx
      setHighlightedGapIndex(idx)
    },
    [ids],
  )

  React.useEffect(() => {
    if (!activeId) return

    const onMove = (e: PointerEvent) => {
      if (!dragUsedPointerRef.current) return
      syncGapFromPointerY(e.clientY)
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [activeId, syncGapFromPointerY])

  /**
   * Snapshot nearest gap after layout — centres rely on row refs updated after paint.
   */
  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)

    dragUsedPointerRef.current =
      event.activatorEvent instanceof PointerEvent || event.activatorEvent instanceof MouseEvent

    gapIndexRef.current = null
    setHighlightedGapIndex(null)

    const native = event.activatorEvent
    let pointerY: number | null = null
    if (native instanceof PointerEvent || native instanceof MouseEvent) {
      pointerY = native.clientY
    }

    requestAnimationFrame(() => {
      if (!dragUsedPointerRef.current) return
      if (pointerY != null) {
        syncGapFromPointerY(pointerY)
        return
      }
      const idx = items.findIndex((i) => i.id === id)
      if (idx >= 0) {
        gapIndexRef.current = idx
        setHighlightedGapIndex(idx)
      }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const draggedId = String(active.id)

    if (dragUsedPointerRef.current && gapIndexRef.current !== null) {
      onReorder({
        next: reorderItemsByGapIndex({
          items,
          activeId: draggedId,
          gapIndex: gapIndexRef.current,
        }),
      })
    } else if (over !== null && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === draggedId)
      const newIndex = items.findIndex((i) => i.id === String(over.id))
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder({ next: arrayMove(items, oldIndex, newIndex) })
      }
    }

    dragUsedPointerRef.current = false
    setActiveId(null)
    setHighlightedGapIndex(null)
    gapIndexRef.current = null
  }

  function handleDragCancel() {
    dragUsedPointerRef.current = false
    setActiveId(null)
    setHighlightedGapIndex(null)
    gapIndexRef.current = null
  }

  const isDragging = activeId !== null

  if (items.length === 0) return null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {/* Column of gap slots + rows — highlighted gap expands to 14px with centred blue stroke */}
        <div className="flex flex-col">
          <GapIndicatorSlot gapIndex={0} highlightedGapIndex={highlightedGapIndex} isDragging={isDragging} />
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              <SortableSchemaRow<T>
                item={item}
                index={index}
                itemCount={items.length}
                registerRowElement={registerRowElement}
                renderRow={renderRow}
              />
              <GapIndicatorSlot
                gapIndex={index + 1}
                highlightedGapIndex={highlightedGapIndex}
                isDragging={isDragging}
              />
            </React.Fragment>
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {renderDragOverlay && activeItem ? renderDragOverlay({ item: activeItem }) : null}
      </DragOverlay>
    </DndContext>
  )
}
