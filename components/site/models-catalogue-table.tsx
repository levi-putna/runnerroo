import type { GatewayModel } from "@/lib/ai-gateway/types"
import { cn } from "@/lib/utils"

/**
 * Responsive catalogue table for the public models page (gateway pricing and metadata).
 */
export function ModelsCatalogueTable({
  models,
  className,
}: {
  models: GatewayModel[]
  className?: string
}) {
  if (models.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        No models are available right now. Try again shortly.
      </p>
    )
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border/70 shadow-sm", className)}>
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        {/* Column headers */}
        <thead className="sticky top-0 z-[1] border-b border-border bg-muted/50 backdrop-blur-sm">
          <tr className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">
              Model
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Provider
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Context
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Input
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Output
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Released
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card/40">
          {models.map((model) => (
            <tr key={model.id} className="hover:bg-muted/30">
              {/* Model name + id */}
              <td className="px-4 py-3 align-top">
                <div className="font-medium text-foreground">{model.shortName}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">{model.id}</div>
              </td>
              <td className="px-4 py-3 align-top text-foreground">{model.providerLabel}</td>
              <td className="px-4 py-3 align-top font-mono tabular-nums text-muted-foreground">
                {model.contextLabel ?? "-"}
              </td>
              <td className="px-4 py-3 align-top font-mono tabular-nums text-muted-foreground">
                {model.inputPriceLabel ?? "-"}
              </td>
              <td className="px-4 py-3 align-top font-mono tabular-nums text-muted-foreground">
                {model.outputPriceLabel ?? "-"}
              </td>
              <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                {model.releaseDateLabel ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
