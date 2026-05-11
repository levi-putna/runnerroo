import type { Metadata } from "next"

import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

/**
 * Builds default SEO metadata for a single workflow step learn article.
 */
export function workflowStepLearnMetadata({ definition }: { definition: StepDefinition }): Metadata {
  const title = `${definition.label} step | Learn | Dailify`
  const description = definition.description

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  }
}
