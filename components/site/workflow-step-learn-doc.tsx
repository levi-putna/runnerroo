import type { ReactNode } from "react"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag, LearnExprVarTable } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"
import {
  WORKFLOW_STEP_GROUP_META,
  type WorkflowStepGroupId,
} from "@/lib/workflows/engine/node-type-registry"
import type { StepDefinition } from "@/lib/workflows/engine/step-definition"

function learnTitleLeadingForDefinition({ definition }: { definition: StepDefinition }) {
  if (definition.type === "entry") {
    return (
      <LearnWorkflowStepTitleIcon type="entry" entryType={definition.subtype} />
    )
  }
  if (definition.type === "ai") {
    return <LearnWorkflowStepTitleIcon type="ai" aiSubtype={definition.subtype} />
  }
  if (definition.type === "document") {
    return <LearnWorkflowStepTitleIcon type="document" documentSubtype={definition.subtype} />
  }
  return <LearnWorkflowStepTitleIcon type={definition.type} />
}

/**
 * Learn hub path for the step&apos;s canvas group (matches learn sidebar family titles).
 */
function familyOverviewHrefForDefinition({ definition }: { definition: StepDefinition }): string {
  const byGroup: Record<WorkflowStepGroupId, string> = {
    triggers: "/learn/workflows/steps/triggers",
    logic: "/learn/workflows/steps/logic",
    human: "/learn/workflows/steps/human",
    ai: "/learn/workflows/steps/ai",
    code: "/learn/workflows/steps/code",
    documents: "/learn/workflows/steps/documents",
    actions: "/learn/workflows/steps/actions",
    termination: "/learn/workflows/steps/termination",
  }

  return byGroup[definition.group]
}

/**
 * Short label for the family overview link (sidebar and learn hub use the same names).
 */
function familyOverviewLinkLabel({ definition }: { definition: StepDefinition }): string {
  return WORKFLOW_STEP_GROUP_META[definition.group].title
}

function executionSectionCopy({ definition }: { definition: StepDefinition }): ReactNode {
  switch (definition.group) {
    case "triggers":
      return (
        <p>
          Triggers start a run and declare the initial payload. They do not use an{" "}
          <strong>Execution</strong> tab like runnable steps. Configure invoke fields, webhook mapping, or schedule
          timing on the trigger-specific panels instead. See{" "}
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link> for how runnable steps use
          that tab.
        </p>
      )
    case "logic":
      return (
        <p>
          Logic steps evaluate <Link href="/learn/workflows/steps/expressions">expression variables</Link> in gate
          cells. Use the <strong>Gate</strong> tab for decision and switch, the <strong>Branch</strong> tab on split to
          name parallel paths, and <strong>Output</strong> where you need per-branch shapes. Execution-style runtime
          knobs are minimal compared with AI or code.
        </p>
      )
    case "human":
      return (
        <p>
          Human steps are driven by inbox behaviour and reviewer actions rather than a model or sandbox. There is no
          traditional <strong>Execution</strong> tab; focus on labels, reviewer copy, timeouts if offered, and output
          mappings for approve versus decline.
        </p>
      )
    case "ai":
      return (
        <p>
          Open the <strong>Execution</strong> tab for model choice, instructions (or subtype-specific bodies such as
          content to summarise), and fields that feed the runner. See{" "}
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link> for a cross-family overview.
        </p>
      )
    case "code":
      return (
        <p>
          Random and iteration steps expose bounds, expressions, and counter rules on <strong>Execution</strong>. See{" "}
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link> for how that tab differs from
          the <strong>Output</strong> tab, and read the <Link href="/learn/workflows/steps/code">Code</Link> guide if you
          need arbitrary JavaScript instead.
        </p>
      )
    case "documents":
      return (
        <p>
          Use <strong>Execution</strong> for model instructions, template bindings, or DocXML-specific fields. The{" "}
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link> article summarises how this
          tab differs from <strong>Output</strong>, where you map download metadata for downstream steps.
        </p>
      )
    case "actions":
      return (
        <p>
          Built-in actions follow the integration fields on <strong>Execution</strong>. Webhook steps expose method,
          URL, headers, and body templates there. See{" "}
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link> for the shared mental model.
        </p>
      )
    case "termination":
      return (
        <p>
          The end step usually has little on <strong>Execution</strong>; focus on <strong>Output</strong> when you must
          shape the final branch payload. Read{" "}
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link> for how tabs split runtime work
          from outbound mapping.
        </p>
      )
    default:
      return null
  }
}

function outputSectionForDefinition({ definition }: { definition: StepDefinition }): ReactNode {
  if (definition.group === "triggers") {
    return (
      <>
        <p>
          Triggers publish invoke fields, webhook payload slices, or schedule metadata that later hops read as{" "}
          <ExpressionVariableTag id="trigger_inputs.*" /> and related
          namespaces. Use <strong>Output</strong> only when the product exposes mapping for your trigger variant.
        </p>
        <LearnExprVarTable
          rows={[
            {
              id: "trigger_inputs",
              description: "Namespace for values captured from the trigger on early hops (shape depends on trigger type).",
            },
          ]}
        />
      </>
    )
  }

  if (definition.group === "ai") {
    return (
      <>
        <p>
          Map stable JSON keys from <ExpressionVariableTag id="exe.*" /> (and other resolved tags) into the object the next node
          receives as <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>. Use{" "}
          <strong>Import from execution</strong> when the sheet offers it, then adjust names to match your downstream
          contracts.
        </p>
        <LearnExprVarTable
          rows={[
            {
              id: "exe",
              description: "Execution record for this AI run (fields depend on subtype and model output).",
            },
          ]}
        />
      </>
    )
  }

  return (
    <p>
      Use <strong>Output</strong> to map keys from <ExpressionVariableTag id="exe.*" />, literals, or other tags into the JSON
      payload forwarded to the next step. See <Link href="/learn/workflows/steps/expressions">Expression variables</Link>{" "}
      for namespaces and resolution order.
    </p>
  )
}

export type WorkflowStepLearnDocPageProps = {
  definition: StepDefinition
}

/**
 * Standard learn layout for one catalogue workflow step (overview, execution notes, output, related links).
 */
export function WorkflowStepLearnDocPage({ definition }: WorkflowStepLearnDocPageProps) {
  const familyHref = familyOverviewHrefForDefinition({ definition })
  const familyLabel = familyOverviewLinkLabel({ definition })

  return (
    <LearnArticle
      title={definition.label}
      description={definition.description}
      titleLeading={learnTitleLeadingForDefinition({ definition })}
    >
      {/* Intro: role on the graph */}
      <h2>What this step does</h2>
      <p>
        On the canvas this step appears as its own node with handles you wire to neighbours. {definition.description}{" "}
        Open the step sheet to change labels, descriptions, and family-specific fields. See the{" "}
        <Link href={familyHref}>{familyLabel}</Link> article for how this template sits beside related steps.
      </p>

      {/* Execution tab guidance */}
      <h2>Execution tab</h2>
      {executionSectionCopy({ definition })}

      {/* Output tab guidance */}
      <h2>Output tab</h2>
      {outputSectionForDefinition({ definition })}

      {/* Related */}
      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps/expressions">Expression variables</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link>
        </li>
        <li>
          <Link href={familyHref}>{familyLabel} overview</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
        {definition.group === "code" && definition.type !== "code" ? (
          <li>
            <Link href="/learn/workflows/steps/code">Run code</Link>
          </li>
        ) : null}
      </ul>
    </LearnArticle>
  )
}
