# Workflows

This package defines workflow **steps** (canvas rendering, catalogue metadata, and server-side execution), the shared **engine** (graph traversal, persistence, template resolution), and **queries** against Supabase.

## Terminology

| Term | Meaning |
|------|---------|
| **Step** | One vertex in the workflow graph — prefer this over ambiguous “node”. |
| **Step type** | The React Flow `type` string on a step (e.g. `entry`, `ai`, `decision`). |
| **Step subtype** | Optional discriminator when several catalogue rows share one type (e.g. `generate` / `summarize` on `ai`, or `manual` / `webhook` / `schedule` on `entry`). |
| **Entry** | The mandatory first step that receives trigger inputs (`type: "entry"`). |
| **Trigger** | How a workflow run is started (`manual`, `webhook`, `cron` at DB/API level). Distinct from the entry step’s `entryType` (`manual` / `webhook` / `schedule`). |
| **Workflow canvas** | The React Flow editor where steps and edges are arranged. |
| **Step sheet** | The right-hand panel for configuring the selected step’s data (schemas, prompts, branching). |
| **Step catalogue** | The searchable “Add step” picker, grouped by category. |
| **Executor** | Server-only function that runs a step during a workflow **run**. |
| **Runner** | `traverseWorkflowGraph` — walks edges from the entry step, invokes executors, yields `NodeResult` updates. |
| **Run** | One execution stored in `workflow_runs` with `node_results`. |
| **Definition** | Static catalogue metadata: label, description, `defaultData`, presentation (icons / accents). |

## Directory layout

```text
lib/workflows/
  README.md           ← this file
  index.ts            ← catalogue, React Flow nodeTypes, executor factory exports
  engine/             ← graph runner, types, persistence, templates, registry helpers
  queries/            ← Supabase list/detail queries for workflows and runs
  steps/
    triggers/         ← entry family (shared node.tsx + per-variant folders)
    logic/            ← decision, switch, split
    ai/               ← ai family (shared node.tsx + per-subtype folders)
    code/             ← code, random, iteration
    actions/          ← action
    termination/      ← end
```

Families where several catalogue rows share one React Flow `type` (`entry`, `ai`) keep a **single** `node.tsx` at the category folder (React Flow registers one component per `type`). Each variant still has its own `definition.ts` and `executor.ts`.

## Adding a new step

1. **Pick the category** under `steps/` (`triggers`, `logic`, `ai`, `code`, `actions`, `termination`). Add a new folder for the step (or a subfolder under `ai/` / `triggers/` if it is another subtype of an existing `type`).

2. **`definition.ts`** — Export a `StepDefinition` object (see `engine/step-definition.ts`): `type`, optional `subtype`, `group`, `label`, `description`, `defaultData`, and presentation fields (`Icon`, `accentBg`, `accentHex`, optional `glyphClassName`).

3. **`executor.ts`** — Export an async function with signature matching `StepExecutorFn` from `engine/runner.ts` (`{ node, stepInput }` → `Promise<unknown>`). Use `engine/template.ts` for `{{prev.*}}` / `{{input.*}}` resolution where needed. Mark server-only code; do not import executors from client components.

4. **`node.tsx`** (if this step introduces a **new** React Flow `type`) — `'use client'` component registered in `index.ts` `workflowNodeTypes`. If the step reuses an existing `type` (e.g. another `ai` subtype), only add `definition.ts` + `executor.ts` under the family folder; the shared category `node.tsx` already reads `data.subtype` or `data.entryType`.

5. **Register** — Append the definition to `STEP_CATALOGUE` and wire the executor in `createWorkflowStepExecutor` inside `engine/step-executor.ts`. For a new `type`, add the component to `workflowNodeTypes` in `index.ts` and ensure `WorkflowRfNodeType` in `engine/node-type-registry.ts` includes the new type if needed.

6. **Editor UX** — If the step needs extra fields in the step sheet, extend the relevant handler in `components/workflow/node-sheet.tsx` (and share helpers via `engine/` as appropriate).

## Imports

Prefer:

- `@/lib/workflows/engine/...` — runner, types, persist, input schema, registry
- `@/lib/workflows/queries/...` — Supabase queries
- `@/lib/workflows` — catalogue and canvas/nodeTypes for client bundles that only need the public surface

Do not import server-only modules (executors, AI SDK) into client components.
