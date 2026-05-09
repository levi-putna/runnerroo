/**
 * Shared motion presets for stacked “list → detail” editors inside the workflow node sheet.
 */

export const workflowStackSlideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "22%" : "-22%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-16%" : "16%", opacity: 0 }),
}
