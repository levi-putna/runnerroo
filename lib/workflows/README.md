# Workflows

This package defines workflow **steps** (canvas rendering, catalogue metadata, and server-side execution), the shared **engine** (graph traversal, persistence, tag resolution), and **queries** against Supabase.

For **how to author a new step** (files, registration, executor pattern), see **[`steps/README.md`](steps/README.md)** — this document focuses on how runs, inputs, and `{{tag}}` expressions fit together.

---

## Terminology

| Term | Meaning |
|------|---------|
| **Step** | One vertex in the workflow graph — prefer this over ambiguous “node”. |
| **Step type** | The React Flow `type` string on a step (e.g. `entry`, `ai`, `decision`, `webhookCall`). |
| **Step subtype** | Optional discriminator when several catalogue rows share one type (e.g. `generate` / `summarize` on `ai`, or invoke / webhook / schedule on `entry`). |
| **Entry** | The mandatory first step that receives trigger inputs (`type: "entry"`). |
| **Trigger** | How a workflow run is started (manual invoke, webhook, cron, etc. at API/DB level). Distinct from the entry step’s `entryType` (`invoke`, `webhook`, `schedule`). |
| **Workflow canvas** | The React Flow editor where steps and edges are arranged. |
| **Step sheet** | The right-hand panel for configuring the selected step’s data (schemas, prompts, branching). |
| **Step catalogue** | The searchable “Add step” picker (`STEP_CATALOGUE`), grouped by category. |
| **Executor** | Server-only function that runs a step during a workflow **run**. |
| **Runner** | `traverseWorkflowGraph` in `engine/runner.ts` — walks edges from the entry step, invokes executors, yields `NodeResult` updates. |
| **Run** | One execution stored with the graph and per-step results. |
| **Definition** | Static catalogue metadata: label, description, `defaultData`, presentation (icons / accents). |

---

## Directory layout

```text
lib/workflows/
  README.md                 ← this file
  index.ts                  ← client-safe re-exports (catalogue, node types, runner helpers)
  workflow-node-types.tsx   ← React Flow `nodeTypes` map for the editor
  engine/                   ← runner, templates, input schema, gates, persistence, types
  queries/                  ← Supabase list/detail helpers
  steps/
    README.md               ← step authoring detail
    shared/                 ← canvas chrome (BaseNode, handles)
    triggers/ logic/ human/ ai/ code/ documents/ actions/ termination/
  inbox/                    ← approval envelope shaping for the product inbox
  storage/                  ← document bucket helpers
  trigger/                  ← cron / schedule derivation helpers
  workflow-constants.ts      ← normalise + helpers for Settings constants (`{{const.*}}`)
  …                         ← assorted glue (invoke support, cron auth, debug log, etc.)
```

Families where several catalogue rows share one React Flow `type` (`entry`, `ai`, `document`) keep a **single** shared `node.tsx` per family. Each variant still has its own `definition.ts` and usually its own `executor.ts`.

---

## Step input semantics

The previous step's emitted output is now **automatically** the current step's input:

- **Trigger / entry steps** — the workflow's invoke payload is the initial value. `{{input.*}}` and `{{trigger_inputs.*}}` both resolve to that payload.
- **Every other step** — `{{input.*}}` resolves to the **immediate predecessor's emitted output** (`predecessor.step_output_emitted` on the envelope). The original invoke payload remains available everywhere as `{{trigger_inputs.*}}`.

That removes the need for a per-step **Input** tab on non-trigger steps. Prompts, code, URL/body templates, gate expressions, document templates, and output/globals rows reference upstream data directly via `{{input.<key>}}` without declaring mapping rows. The trigger node keeps a single combined **Input** tab that declares invoke fields and shapes the optional output/globals map that flows onwards.

### Trigger passthrough

When a trigger node has **no output rows declared**, `executeEntryNode` shallow-merges the invoke payload onto the emitted output, so the next step receives every invoke key via `{{input.*}}` without per-key mapping. Once you add output rows, those mapped values win for the same key.

### Backward compatibility

`buildResolutionContext` keeps **`prev`** as a runtime alias of `input` for standard steps, so persisted templates and gate expressions that still reference `{{prev.*}}` (or the `prev` Function argument inside compiled gate code) continue to resolve. Tag pickers, default placeholders, and new agent guidance now standardise on `{{input.*}}`.

---

## Tag namespaces (`{{…}}`)

Tags are **`{{dot.path}}`** expressions. `resolveTemplate` in `engine/template.ts` replaces each segment with values from a **resolution context** built by `buildResolutionContext`, optionally extended per phase.

### Available in the base context (before the current step’s `exe` exists)

| Prefix | Source | Typical use |
|--------|--------|-------------|
| **`input.*`** | Predecessor step's emitted output (entry: invoke payload) | `{{input.summary}}` from the previous step |
| **`trigger_inputs.*`** | Original workflow invoke payload, carried on every hop | `{{trigger_inputs.customer_id}}` deep in the graph |
| **`prev.*`** | Legacy alias of `input.*` for back-compat with persisted templates | Continues to resolve; new copy uses `input.*` |
| **`global.*`** | Accumulated **workflow globals** merged from prior steps’ `globalsSchema` results (`runner.ts` + envelope `globals`) | Cross-cutting counters, flags, normalised ids |
| **`const.*`** | **Workflow constants** from Settings (`workflows.workflow_constants`), copied onto every envelope hop | Shared base URLs, fixed tokens, reusable snippets (`{{const.base_url}}`) |
| **`run.*`** | `{ id }` — workflow run id when gateway context is present | Auditing, filenames |
| **`workflow.*`** | `{ id, name }` | Titles, metadata |
| **`step.*`** | `{ id }` — current React Flow step id | Debugging, logging |
| **`user.*`** | `{ name, email }` from gateway context when available | Personalised copy |
| **`now.*`** | UTC clock helpers (`iso`, `date`, `time_24`, `slug_timestamp`, weekday fields, etc.) | File names, time-stamped text |

Details and field lists: JSDoc on **`buildResolutionContext`** in `engine/template.ts`.

### `exe.*` — execution output of the **current** step

When a step finishes its main work (model call, HTTP request, gate evaluation, etc.), executors build an **`exe`** object (e.g. AI tokens and text, webhook `status_code`, decision `decision_result`). That object is **not** part of the inbound `stepInput` for the same step’s prompts.

It **is** merged into an **output context**:

```text
outputContext = { ...baseContext, exe: exeContext }
```

used to resolve:

- **`outputSchema`** — maps to the step’s public output keys (and often spread onto **`{{prev.*}}`** for the next step).
- **`globalsSchema`** — contributes to **`{{global.*}}`** for downstream steps.

So in the **Output** and **Globals** tabs, tags like **`{{exe.text}}`**, **`{{exe.status_code}}`**, **`{{exe.classifier_label}}`** are valid **after** the step’s logic has defined `exe`. Suggestions for many of these live in `engine/prompt-tags.ts`.

### Condition rows (Decision / Switch gates)

Gate rules (`engine/gate-rule.ts`) reference **fields** such as `input.status`, `global.count`, or `constants.base_url`. Inside compiled boolean expressions the runner exposes five arguments — `input`, `prev` (alias of `input`), `global`, `trigger`, and **`constants`** (same map as **`{{const.*}}`** in templates) — so persisted gates can compare trigger data, globals, and workflow constants alongside step output. **Value** cells can be literals or mixed `{{tag}}` templates; the evaluator compiles them to JavaScript for truthy/falsey routing. Keep types in mind: `globalsSchema` coercion can make numeric comparisons reliable (`engine/template.ts` — `coerceFieldValue`).

---

## Execution envelope (what the runner passes as `stepInput`)

Successors do not receive “raw” trigger JSON alone. `mergeDownstreamSimulationPayload` in `engine/runner.ts` builds an **execution envelope** that includes:

- A marker flag (internal; legacy graphs may use an older marker name).
- **`trigger_inputs`** — original invoke payload, carried through the whole run.
- **`globals`** — shallow merge of globals picked up from previous steps’ outputs.
- **`workflow_constants`** — author-defined map from **Workflow settings** (same source as `workflows.workflow_constants`); exposed to templates as **`{{const.*}}`** via `buildResolutionContext`.
- **`predecessor`** — `node_id`, step type, **`step_input_received`**, and **`step_output_emitted`** (this last object is what **`{{input.*}}`** reads on standard steps; `{{prev.*}}` still resolves against the same object for back-compat).
- Optional gateway attribution for AI usage and `user` / `workflow` / `run` tags.

Executors should use **`buildResolutionContext({ stepInput, stepId })`** rather than hand-rolling this shape.

---

## Output schema and globals schema

Both are **`NodeInputField[]`** rows (same structural type as function input), but **semantics** differ:

- **`outputSchema`** — defines the **outbound** key/value pairs this step publishes. Values are templates, usually resolved with **`outputContext`** (includes **`exe`**). Results are typically spread on the step output so the next hop sees them as **`{{input.your_key}}`**.
- **`globalsSchema`** — optional rows that write into the run’s shared **`globals`** map for **`{{global.your_key}}`** on later steps.

---

## Imports

Prefer:

- `@/lib/workflows/engine/…` — runner, types, persistence, input schema, templates, registry
- `@/lib/workflows/queries/…` — Supabase queries
- `@/lib/workflows` — catalogue and `workflowNodeTypes` for client bundles that only need the public surface

Do **not** import server-only modules (for example `engine/step-executor` and heavy AI executors) into client components.

---

## Adding a new step (short pointer)

1. Implement under `steps/` — see **[`steps/README.md`](steps/README.md)** for the full checklist.
2. Register the **definition** in `steps/catalogue.ts`.
3. Register the **executor** in `engine/step-executor.ts` (`dispatchWorkflowStep`).
4. Register the **canvas component** in `workflow-node-types.tsx` (and extend `WorkflowRfNodeType` / meta in `engine/node-type-registry.ts` when introducing a new visual kind).
5. Extend **`components/workflow/node-sheet.tsx`** (and any default-data helpers in `workflow-canvas.tsx`) when the editor needs new fields.

---

## Reference map

| Concern | Primary location |
|--------|-------------------|
| Workflow constants (Settings UI + JSON helpers) | `workflow-constants.ts` |
| Template resolution & `exe` / output / globals helpers | `engine/template.ts` |
| Input / output / globals field types | `engine/input-schema.ts` |
| Tag suggestions for the Function input UI | `engine/prompt-tags.ts` |
| Graph traversal & envelope merge | `engine/runner.ts` |
| Gate model & value → JS compilation | `engine/gate-rule.ts` |
| Step dispatch | `engine/step-executor.ts` |
| Step catalogue | `steps/catalogue.ts` |
| Canvas node registry | `workflow-node-types.tsx` |
