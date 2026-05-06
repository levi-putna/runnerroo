import { toPng } from "html-to-image"

/**
 * Builds a safe PNG file name from the workflow title.
 */
export function buildWorkflowImageDownloadFileName({ name }: { name: string }): string {
  const trimmed = name.trim() || "workflow"
  const safe = trimmed
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120)
  return safe.toLowerCase().endsWith(".png") ? safe : `${safe}.png`
}

/**
 * Captures the React Flow renderer as a PNG and triggers a browser download, using html-to-image
 * (see the React Flow guide: https://reactflow.dev/examples/misc/download-image — pin 1.11.11 in package.json
 * because later releases can regress exports).
 *
 * @param flowRoot - A wrapper element that contains a single `.react-flow` instance (e.g. the canvas container).
 */
export async function downloadWorkflowFlowAsPng({
  flowRoot,
  fileName,
}: {
  flowRoot: HTMLElement
  fileName: string
}): Promise<void> {
  const renderer = flowRoot.querySelector(".react-flow__renderer") as HTMLElement | null
  if (!renderer) return

  const flowSurface = flowRoot.querySelector(".react-flow") as HTMLElement | null
  const backgroundColorFromTheme = flowSurface
    ? getComputedStyle(flowSurface).backgroundColor
    : null
  const backgroundColor =
    backgroundColorFromTheme && backgroundColorFromTheme !== "rgba(0, 0, 0, 0)"
      ? backgroundColorFromTheme
      : "oklch(0.99 0 0)"

  const dataUrl = await toPng(renderer, {
    cacheBust: true,
    backgroundColor,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true
      const { classList } = node
      return (
        !classList.contains("react-flow__minimap") &&
        !classList.contains("react-flow__controls") &&
        !classList.contains("react-flow__panel")
      )
    },
  })

  const anchor = document.createElement("a")
  anchor.setAttribute("download", fileName)
  anchor.setAttribute("href", dataUrl)
  anchor.click()
}
