"use client"

import { Position, type NodeProps } from "@xyflow/react"
import { Clock, Command, Webhook } from "lucide-react"
import { cn } from "@/lib/utils"
import { WorkflowSourceHandle } from "./handles"

export interface TriggerNodeData {
  label: string
  triggerType: "manual" | "webhook" | "cron"
  config?: Record<string, unknown>
  [key: string]: unknown
}

const triggerConfig = {
  manual: { icon: Command, label: "Manual trigger", color: "bg-blue-500" },
  webhook: { icon: Webhook, label: "Webhook", color: "bg-purple-500" },
  cron: { icon: Clock, label: "Schedule", color: "bg-orange-500" },
}

export function TriggerNode({ data, selected }: NodeProps) {
  const nodeData = data as TriggerNodeData
  const { triggerType = "manual" } = nodeData
  const config = triggerConfig[triggerType] ?? triggerConfig.manual
  const Icon = config.icon

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card shadow-sm min-w-[180px] transition-all",
        selected ? "border-primary shadow-md ring-2 ring-primary/20" : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b">
        <div className={cn("flex items-center justify-center w-6 h-6 rounded-md", config.color)}>
          <Icon className="size-3.5 text-white" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trigger</span>
      </div>
      <div className="px-3 py-2">
        <p className="font-medium text-sm">{nodeData.label || config.label}</p>
        {triggerType === "webhook" && typeof nodeData.config?.path === "string" && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{nodeData.config.path}</p>
        )}
        {triggerType === "cron" && typeof nodeData.config?.schedule === "string" && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{nodeData.config.schedule}</p>
        )}
      </div>
      <WorkflowSourceHandle
        position={Position.Bottom}
        className="!size-3 !bg-primary"
        style={{ bottom: -5 }}
      />
    </div>
  )
}
