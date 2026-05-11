import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import { ExpressionVariableTag } from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"

export const metadata: Metadata = {
  title: "Workflow triggers | Learn | Dailify",
  description: "Invoke, webhook, and schedule entry steps for Dailify workflows.",
  openGraph: {
    title: "Workflow triggers | Learn | Dailify",
    description: "Invoke, webhook, and schedule entry steps for Dailify workflows.",
  },
}

/**
 * Learn: workflow trigger (entry) steps.
 */
export default function LearnWorkflowTriggersPage() {
  return (
    <LearnArticle
      title="Triggers"
      description="Entry nodes start a run: manual invoke, inbound webhook, or a schedule. They declare the initial payload shape the rest of the graph consumes."
      titleLeading={<LearnWorkflowStepTitleIcon type="entry" entryType="invoke" />}
    >
      <h2>Overview</h2>
      <p>
        Every workflow has at least one <strong>trigger</strong> (entry) node. It defines <em>how</em> a run starts and
        <em>what fields</em> arrive on the first hop. Downstream steps read those fields as <ExpressionVariableTag id="input.*" /> and always as{" "}
        <ExpressionVariableTag id="trigger_inputs.*" /> on later hops.
      </p>

      <h2>Steps in this family</h2>
      <h3>Invoke (manual)</h3>
      <p>
        Starts when a person or integration sends a payload through the product&apos;s run action. You declare invoke
        fields and optional globals on the <strong>Input</strong> tab; those keys become the first step&apos;s output.
      </p>
      <h3>Webhook</h3>
      <p>
        Starts when an HTTP caller hits your workflow&apos;s webhook URL. The body, headers, or query parts you map
        become the invoke-shaped payload: design fields so your API consumers stay stable across versions.
      </p>
      <h3>Schedule</h3>
      <p>
        Starts on a cron-style timetable. Scheduled runs often carry a minimal synthetic payload or timestamps; combine
        with <Link href="/learn/workflows/steps/expressions">expression variables</Link> such as{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">now</code> when you need fresh filenames or
        window labels.
      </p>

      <h2>Configuration</h2>
      <p>
        Triggers use <strong>General</strong> (label, description) and the combined <strong>Input</strong> tab for
        payload schema, globals, and trigger-specific wiring, not the <strong>Execution</strong> tab used by AI or code
        steps.
      </p>

      <h2>Data flow</h2>
      <p>
        If you declare <strong>no</strong> custom output rows on the trigger, the runner typically forwards the whole
        invoke object to the next step. Once you add mapped rows, those mappings define exactly which keys appear on
        the output object.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/runs">Runs and schedules</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/expressions">Expression variables</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
