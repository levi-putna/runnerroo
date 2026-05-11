import type { Metadata } from "next"
import Link from "next/link"

import { LearnArticle } from "@/components/site/learn-article"
import {
  ExpressionVariableTag,
  LearnDocTwoColumnTable,
  LearnDocWideTable,
  LearnExprVarTable,
} from "@/components/site/learn-doc-table"
import { LearnWorkflowStepTitleIcon } from "@/components/site/learn-workflow-step-title-icon"
import { GLOBAL_PROMPT_TAGS, type PromptTagDefinition } from "@/lib/workflows/engine/prompt-tags"

export const metadata: Metadata = {
  title: "Expression variables | Learn | Dailify",
  description:
    "Workflow tags: what expression variables are, when they resolve, namespaces on each hop, and built-in system tokens (now, run, workflow, step, user).",
  openGraph: {
    title: "Expression variables | Learn | Dailify",
    description:
      "Workflow tags: what expression variables are, when they resolve, namespaces on each hop, and built-in system tokens (now, run, workflow, step, user).",
  },
}

/** Stable section order for grouped system-tag tables on the learn page. */
const SYSTEM_TAG_GROUP_ORDER = ["now", "run", "workflow", "step", "user"] as const

/**
 * Human-readable heading for a system-tag group, keyed by the token prefix (segment before the first dot).
 */
function systemTagGroupHeading({ prefix }: { prefix: string }): string {
  switch (prefix) {
    case "now":
      return "Time helpers (UTC)"
    case "run":
      return "Run metadata"
    case "workflow":
      return "Workflow metadata"
    case "step":
      return "Step metadata"
    case "user":
      return "Runner profile"
    default:
      return `${prefix} · system`
  }
}

/**
 * Groups {@link GLOBAL_PROMPT_TAGS} by top-level id prefix for learn-page tables.
 */
function groupedGlobalPromptTagsForLearn(): { prefix: string; tags: PromptTagDefinition[] }[] {
  const byPrefix = new Map<string, PromptTagDefinition[]>()
  for (const tag of GLOBAL_PROMPT_TAGS) {
    const prefix = tag.id.includes(".") ? (tag.id.split(".")[0] ?? "other") : tag.id
    const bucket = byPrefix.get(prefix)
    if (bucket) bucket.push(tag)
    else byPrefix.set(prefix, [tag])
  }

  const out: { prefix: string; tags: PromptTagDefinition[] }[] = []
  for (const p of SYSTEM_TAG_GROUP_ORDER) {
    const tags = byPrefix.get(p)
    if (tags?.length) {
      out.push({ prefix: p, tags })
      byPrefix.delete(p)
    }
  }
  const rest = [...byPrefix.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [prefix, tags] of rest) {
    if (tags.length) out.push({ prefix, tags })
  }
  return out
}

/**
 * Learn: expression variables (tag / template variables) in workflows.
 */
export default function LearnWorkflowExpressionsPage() {
  const systemTagGroups = groupedGlobalPromptTagsForLearn()

  return (
    <LearnArticle
      title="Expression variables"
      description="Template placeholders you may have called function variables, tag variables, or merge fields: the `{{…}}` syntax that pulls live data into prompts, code, URLs, and output mappings."
      titleLeading={<LearnWorkflowStepTitleIcon type="ai" aiSubtype="extract" />}
    >
      <h2>What they are</h2>
      <p>
        An <strong>expression variable</strong> is a{" "}
        <ExpressionVariableTag id="dot.path" /> token. At run time the
        workflow engine replaces each token with a value from a <strong>resolution context</strong> (objects keyed by
        namespace, such as{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">trigger_inputs</code>, or{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">global</code>). Literals and multiple tags can
        be mixed in the same field; the result is usually a string that the runner may coerce (for example to a number)
        when a field has a type.
      </p>
      <p>
        In the editor, fields that support tags offer autocomplete when you type{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">{"{{"}</code>. The same syntax appears in gate
        rules, HTTP templates, JavaScript source (resolved before the script runs), and output rows.
      </p>

      <h2>When they resolve</h2>
      <p>Resolution happens in two phases. The table below summarises what each phase can see.</p>
      <LearnDocTwoColumnTable
        valueHeader="Phase"
        descriptionHeader="Details"
        rows={[
          {
            key: "before",
            value: "Before the step runs",
            valueCellClassName: "whitespace-nowrap font-medium text-foreground",
            description: (
              <>
                <p className="mb-2">
                  <strong className="text-foreground">Typical fields:</strong> prompts, code bodies, webhook URLs, gate{" "}
                  <em>value</em> cells, and similar pre-execution configuration.
                </p>
                <p>
                  <strong className="text-foreground">Context:</strong> the <strong>base context</strong>: inbound graph
                  data, globals so far, workflow constants, run and workflow metadata, step and user helpers, UTC{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">now</code> tokens,{" "}
                  <ExpressionVariableTag id="input.*" />, <ExpressionVariableTag id="trigger_inputs.*" />, and so on. This phase does{" "}
                  <em>not</em> include this step&apos;s own{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">exe</code> object yet.
                </p>
              </>
            ),
          },
          {
            key: "after",
            value: "After the step's main work",
            valueCellClassName: "whitespace-nowrap font-medium text-foreground",
            description: (
              <>
                <p className="mb-2">
                  <strong className="text-foreground">Typical fields:</strong> <strong>Output</strong> schema rows and{" "}
                  <strong>Globals</strong> mappings for the same step.
                </p>
                <p>
                  <strong className="text-foreground">Context:</strong> an <strong>output context</strong> that extends the
                  base context with <ExpressionVariableTag id="exe.*" />: model text, HTTP status, decision outcome, sandbox return
                  value, or whatever that template produced.
                </p>
              </>
            ),
          },
        ]}
      />

      <h2>What <ExpressionVariableTag id="input.*" /> means</h2>
      <p>
        For <strong>trigger</strong> steps, <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>{" "}
        is the workflow invoke payload (the same object as{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">trigger_inputs</code>). For every other step,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code> is the{" "}
        <strong>immediate predecessor&apos;s emitted output</strong>. You do not configure per-step input mapping; the
        edge into the step defines where the data comes from.
      </p>
      <p>
        <ExpressionVariableTag id="trigger_inputs.*" /> always refers to
        the original invoke payload on every hop, which is useful deep in a branch.
      </p>
      <p>
        <ExpressionVariableTag id="prev.*" /> is a legacy alias of{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code> for older graphs; new copy should
        prefer <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">input</code>.
      </p>

      <h2>Main namespaces (types of value)</h2>
      <p>
        Each row is a prefix on the resolution object. Tokens look like{" "}
        <ExpressionVariableTag id="namespace.key" />.
      </p>
      <LearnDocWideTable
        headers={["Namespace", "Example", "Description"]}
        tableClassName="min-w-[40rem]"
        rows={[
          {
            key: "input-prev",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "input · prev",
              <ExpressionVariableTag id="input.summary" key="ns-input-summary" />,
              <>
                Predecessor output or trigger payload (object). Keys match your predecessor output schema or invoke field
                names. <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">prev</code> is a legacy alias
                for the same object.
              </>,
            ],
          },
          {
            key: "trigger_inputs",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "trigger_inputs",
              <ExpressionVariableTag id="trigger_inputs.email" key="ex" />,
              <>Original workflow invoke payload for the run (object). Available on every hop.</>,
            ],
          },
          {
            key: "global",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "global",
              <ExpressionVariableTag id="global.tenant_id" key="ns-global-tenant" />,
              <>
                Accumulated workflow globals from earlier steps (object). Keys come from globals schema rows across the
                graph; later writes for the same key win.
              </>,
            ],
          },
          {
            key: "const",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "const",
              <ExpressionVariableTag id="const.api_base_url" key="ex" />,
              <>
                Workflow constants from workflow settings (object). Same values on every step when you configure them;
                keys are defined in Settings, not by the runner.
              </>,
            ],
          },
          {
            key: "exe",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "exe",
              <ExpressionVariableTag id="exe.text" key="ns-exe-text" />,
              <>
                This step&apos;s execution result (object). Only in output and globals resolution, not in the raw prompt
                before the model or sandbox runs, unless the product resolves that field in a second pass.
              </>,
            ],
          },
          {
            key: "meta",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "run · workflow · step · user",
              <ExpressionVariableTag id="run.id" key="ns-run-id" />,
              <>
                Small metadata scalars (ids, workflow title, graph node id, signed-in runner). See{" "}
                <a href="#system-expression-variables">System expression variables</a> for the built-in list.
              </>,
            ],
          },
          {
            key: "now",
            cellClassNames: ["font-mono text-xs font-semibold text-foreground", "", ""],
            cells: [
              "now",
              <ExpressionVariableTag id="now.iso" key="ns-now-iso" />,
              <>
                UTC time helpers (ISO string, date, clock times, slug-friendly timestamps). Fully enumerated under{" "}
                <a href="#system-expression-variables">System expression variables</a>.
              </>,
            ],
          },
        ]}
      />

      <h2 id="system-expression-variables">System expression variables</h2>
      <p>
        These tokens are merged into <strong>every</strong> expression-capable field in the editor (alongside
        workflow-specific tags such as <ExpressionVariableTag id="input.*" />, <ExpressionVariableTag id="global.*" />, and{" "}
        <ExpressionVariableTag id="const.*" /> when configured). Values are resolved by the runner at the time the expression is
        evaluated. See <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">GLOBAL_PROMPT_TAGS</code> in the
        codebase for the canonical list (the tables below are generated from that source).
      </p>
      <p className="text-sm font-medium text-foreground">
        Tables below use the same Value / Description layout as the{" "}
        <Link href="/learn/workflows/steps/code">Code</Link> learn page (purple monospace tokens).
      </p>
      {systemTagGroups.map(({ prefix, tags }) => (
        <section key={prefix} className="space-y-2">
          <h3>{systemTagGroupHeading({ prefix })}</h3>
          <LearnExprVarTable
            rows={tags.map((tag) => ({
              id: tag.id,
              label: tag.label,
              description: tag.description,
            }))}
          />
        </section>
      ))}

      <h2>Types and coercion</h2>
      <p>
        Tags interpolate to text first. Where a row has a type (number, boolean, JSON, and so on), the runner coerces the
        resolved string. Keep formats predictable: for example ISO dates for date fields, plain digits for integers, and
        valid JSON inside a tag when a JSON field is expected.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/learn/workflows/steps">Steps and behaviour hub</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/execution-settings">Execution settings</Link>
        </li>
        <li>
          <Link href="/learn/workflows/steps/code">Code</Link>
        </li>
      </ul>
    </LearnArticle>
  )
}
