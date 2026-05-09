# Workflow steps

This folder holds **workflow step implementations**: catalogue metadata for the add-step picker, React Flow canvas nodes, and (where needed) server-side executors. Steps are grouped by domain (`triggers/`, `logic/`, `ai/`, etc.) so related behaviour stays together.

## How a step fits the system

A persisted workflow is a React Flow graph (`nodes` + `edges`). Each node has a string `type` (and optional `data.subtype` for families such as AI templates). Three layers consume that graph:

| Layer | Responsibility |
|--------|----------------|
| **Catalogue** (`catalogue.ts` → `STEP_CATALOGUE`) | Rows in the add-step sheet: label, description, `defaultData`, icon, colours, `group`. |
| **Canvas** (`lib/workflows/workflow-node-types.tsx`) | Maps `node.type` to a client React component (`node.tsx`) registered with React Flow. |
| **Runner** (`lib/workflows/engine/step-executor.ts`) | Maps `node.type` (and sometimes `data.subtype`) to an `execute*Step` function when a real run executes the graph. |

If you add a new `type` but forget the canvas map, the node may not render correctly. Cross-check: **every `type` appearing in `STEP_CATALOGUE` should exist as a key on `workflowNodeTypes`** in `workflow-node-types.tsx`. If you forget the executor branch, unknown types fall through to `buildStubOkStepOutput` (minimal `{ kind, node_id, label, ok }` payload).

**Do not** import `step-executor.ts` (or anything that pulls it) from client components — that module is intended to stay server-side.

## Step input semantics

The runner resolves **`{{input.*}}`** differently for trigger nodes versus everything else:

| Step role | What `{{input.*}}` binds to | Where the workflow invoke payload lives |
|-----------|-----------------------------|------------------------------------------|
| `entry` (trigger) | The workflow's invoke payload — same source as `{{trigger_inputs.*}}`. | `{{input.*}}` and `{{trigger_inputs.*}}` are the same object. |
| Standard (everything else) | The **immediate predecessor's emitted output** — the previous step's output object becomes this step's input automatically. | Always available as `{{trigger_inputs.*}}` on every hop. |

This means **non-trigger steps no longer need a per-step Input tab** to declare mapping rows — prompts, code, URL/body templates, gate expressions, document templates, and output/globals rows all reference the upstream step's output directly via `{{input.<key>}}`. Trigger steps keep a single **Input** tab in the editor: declare invoke / webhook / schedule payload fields there, plus optional **Workflow globals** when you need `{{global.*}}` on the same trigger.

### Trigger inputs are the outbound payload

For **`entry`** nodes, the **Input** tab persists `inputSchema`. That is the authoring-friendly name (the first node receives the trigger envelope as inputs). At run time the entry executor evaluates those same rows with **`resolveOutputSchemaFields`** — the same pipeline as any other step’s **Output schema** — so downstream steps still receive the trigger as predecessor output via `{{input.*}}`. You do **not** maintain a separate trigger **output** list.

- **No payload rows:** the executor shallow-merges the entire invoke object onto the emitted output (full passthrough).
- **At least one payload row:** only declared keys are emitted; a blank mapping cell on a row defaults to `{{input.<key>}}` so that key passes through from the envelope under the same name.
- **Legacy graphs** may still store a separate `outputSchema`; if `inputSchema` is empty the executor falls back to those rows. If both exist, blank cells on `inputSchema` can inherit the legacy output mapping for the same key.

### Trigger passthrough (summary)

Empty **payload** field list ⇒ full invoke passthrough. Non-empty list ⇒ declared keys only, with per-key defaults as above.

### Available tag namespaces

Every executor that calls `buildResolutionContext` exposes the same tag palette:

| Namespace | Source | Notes |
|-----------|--------|-------|
| `{{input.*}}` | Predecessor output (entry: invoke payload) | Standard-step default for upstream data. |
| `{{trigger_inputs.*}}` | Original workflow invoke payload | Available on every hop — useful for revisiting trigger context after several steps. |
| `{{global.*}}` | Accumulated workflow globals | Any earlier step can write `globals` rows; later writes for the same key win. |
| `{{const.*}}` | **Workflow constants** from Workflow settings (`workflows.workflow_constants`) | Same values on every step — ideal for shared URLs and fixed strings; see **`workflow-constants.ts`**. |
| `{{exe.*}}` | Current step's execution result | Populated inside the executor before resolving `outputSchema` / `globalsSchema` rows. |
| `{{run.*}}`, `{{workflow.*}}`, `{{step.*}}`, `{{user.*}}` | Runner gateway metadata | Identifiers and signed-in author. |
| `{{now.*}}` | Current UTC time helpers | See `buildUtcNowPromptFields`. |

### Backward compatibility

Persisted templates and gate expressions that still reference `{{prev.*}}` (or the legacy `prev` Function argument inside gate code) keep resolving — `prev` is bound to the same predecessor-output object as `input` for standard steps. UI prompts, autocomplete, default expression placeholders, and new agent guidance now standardise on `{{input.*}}`.

## Folder layout

- **`triggers/`** — Entry nodes (`type: "entry"`). Variants use `data.entryType` (`invoke`, `webhook`, `schedule`). Share one canvas component (`triggers/node.tsx`) and one entry executor (`triggers/invoke/executor.ts`) that resolves **`inputSchema`** rows (as outbound output), optional **`globalsSchema`**, and the trigger envelope.
- **`logic/`** — Branching and fan-out: decision, switch, split. Often multiple outbound handles and custom layout; executors evaluate gates or fan out inputs.
- **`human/`** — Steps that pause the run (e.g. approval throws `ApprovalRequiredError`).
- **`ai/`** — All use `type: "ai"`; the template is chosen with `data.subtype` (`generate`, `summarize`, …). One shared canvas node (`ai/node.tsx`); each template has its own `definition.ts` + `executor.ts`.
- **`code/`** — `code`, `random`, `iteration` — distinct React Flow types, each with `definition` + `executor` + `node`.
- **`documents/`** — `type: "document"` with `data.subtype` (`template` | `docxml`). Shared `documents/document-node.tsx` for the canvas.
- **`actions/`** — e.g. generic `action`, `webhookCall`.
- **`termination/`** — End node (`type: "end"`).
- **`shared/`** — Reusable canvas chrome: `BaseNode`, `InputHandle` / `OutputHandle`, run-state ring styling.

## Common file patterns

### 1. `definition.ts` — catalogue row

Exports a **`StepDefinition`** object (see `lib/workflows/engine/step-definition.ts`):

- **`type`** — React Flow `node.type` (must match persistence and dispatch).
- **`subtype`** — Optional discriminator for multi-template families (`ai`, `entry`, `document`).
- **`group`** — One of `WorkflowStepGroupId` (`triggers`, `logic`, `human`, `ai`, `code`, `documents`, `actions`, `termination`) — controls grouping in the add-step sheet.
- **`label`**, **`description`** — Picker copy.
- **`defaultData`** — Initial `node.data` when the user adds the step. Put defaults that the editor and runner expect (`label`, `description`, subtype fields, schema builders, etc.).
- **`Icon`**, **`accentBg`**, **`accentHex`** — Picker and tile presentation, usually taken from **`WORKFLOW_NODE_CORE_META`**, **`WORKFLOW_ENTRY_KIND_META`**, **`WORKFLOW_AI_FAMILY_META`**, or **`WORKFLOW_DOCUMENT_FAMILY_META`** in `node-type-registry.ts`.

**Register the definition** by importing it into `catalogue.ts` and appending it to `STEP_CATALOGUE` in the desired order (sheet groups sort rows by `group`, not by array order alone — see `node-add-sheet.tsx`).

### 2. `executor.ts` — server-side behaviour

Pattern:

```ts
export async function executeYourStep({
  node,
  stepInput,
}: {
  node: Node
  stepInput?: unknown
}): Promise<Record<string, unknown>> {
  // ...
}
```

Conventions:

- Read configuration from **`node.data`** (cast to a typed record when helpful).
- **`stepInput`** is the payload the runner resolved for this step (upstream outputs, trigger inputs, etc.).
- Return a **plain JSON-serialisable object** representing step output. Many steps include `kind`, `node_id`, `label`, `ok`, and spread resolved output fields — downstream steps automatically receive that object as **`{{input.*}}`**.
- Use **`buildStubOkStepOutput({ node })`** when behaviour is not implemented yet.
- For template resolution, **`buildResolutionContext`**, **`resolveTemplate`**, **`resolveOutputSchemaFields`**, **`resolveGlobalsSchema`**, and **`readInputSchemaFromNodeData`** (`lib/workflows/engine/template.ts`, `input-schema.ts`) match patterns in `decision/executor.ts` and `triggers/invoke/executor.ts` (entry uses **`inputSchema`** through **`resolveOutputSchemaFields`** — see [Trigger inputs are the outbound payload](#trigger-inputs-are-the-outbound-payload)). Pass **`role: "entry"`** from the trigger executor; standard executors can omit it (defaults to `"standard"`).
- **Human-in-the-loop**: throw **`ApprovalRequiredError`** (see `human/approval/executor.ts`); the runner treats that as a paused run, not a hard failure.

**Register the executor** inside **`dispatchWorkflowStep`** in `lib/workflows/engine/step-executor.ts` — add a branch on `node.type` (and switch on `subtype` for `ai` / `document` if applicable).

### 3. `node.tsx` — canvas component

Usually a **client component** (`"use client"`) using **`NodeProps`** from `@xyflow/react`.

Typical structure:

- Cast **`data`** to a step-specific interface (include **`[key: string]: unknown`** if you mirror loose persisted data).
- **`useWorkflowNodeRunRingClassName(id)`** + **`workflowStepShellClassName`** from `shared/base-node.tsx` for selection and run overlays.
- **`BaseNode`** for the standard card (icon tile, uppercase title, type pill, optional description).
- **`InputHandle`** / **`OutputHandle`** from `shared/handles.tsx` for single-in / single-out steps; branching steps use **`WorkflowTargetHandle`** / **`WorkflowSourceHandle`** with explicit `handleId`s and positioning (see `logic/switch/node.tsx`, `logic/decision/node.tsx`).
- Resolve icons and colours with **`resolveWorkflowNodeTilePresentation`** or **`WORKFLOW_NODE_CORE_META`** / family meta from `node-type-registry.ts`, and **`WorkflowNodeGlyph`** from `@/components/workflow/node-type-presentation` where applicable.

**Register the component** in **`lib/workflows/workflow-node-types.tsx`** under the same key as `node.type`.

### 4. Optional helpers

- **`defaults.ts`** — Normalisers and builders for complex `data` shapes (e.g. AI extract field rows, classify options) shared by the canvas, node sheet, and definitions.
- **`context.ts`** — Shared resolution context builders (e.g. approval message templating).

## Families vs standalone types

- **Entry (`entry`)** — One React Flow type, **`entryType`** selects invoke / webhook / schedule. Definitions live per trigger; executor is shared.
- **AI (`ai`)** — One **`AiNode`**; **`subtype`** selects which executor runs. Each template gets its own row in `STEP_CATALOGUE` with matching `defaultData.subtype`.
- **Document (`document`)** — Same idea with **`WorkflowDocumentSubtype`** and **`WorkflowDocumentNode`**.
- **Standalone types** — `action`, `code`, `decision`, `webhookCall`, … each need their own `type` string, canvas component, and executor branch unless you deliberately reuse another node’s component (unusual).

## Editor integration beyond the step folder

Adding a step often touches:

- **`lib/workflows/engine/node-type-registry.ts`** — Extend **`WorkflowRfNodeType`**, **`WORKFLOW_NODE_CORE_META`**, or subtype unions if you introduce a new visual kind or picker metadata.
- **`components/workflow/workflow-canvas.tsx`** — **`handleAddNode`** may need extra logic to merge default schemas or fields when `def.type` / `def.subtype` match (see existing `ai`, `random`, `iteration`, `document` branches).
- **`components/workflow/node-sheet.tsx`** — Form sections, prompt tags, and bindings for `node.data` fields.

## Checklist: adding a new step

1. **Choose `type` (and `subtype` if part of a family)** — align with `WorkflowRfNodeType` / registry enums.
2. **Add `definition.ts`** and export from **`catalogue.ts`**.
3. **Implement `executor.ts`** and wire **`dispatchWorkflowStep`**.
4. **Implement `node.tsx`** (or extend a family node) and register in **`workflow-node-types.tsx`**.
5. **Update `node-type-registry.ts`** if the type is new to the engine’s unions or meta tables.
6. **Adjust node sheet / canvas add-node** if the step needs special default scaffolding.
7. **Workflow constants** — authors manage shared `{{const.*}}` values under **Workflow settings** (`/app/workflows/[id]/settings`); runners merge them from `workflows.workflow_constants` into every envelope (`engine/runner.ts`).
8. **Run the graph** — confirm the runner payload and field resolution match expectations (entry: `inputSchema` + optional `globalsSchema`; other steps: `outputSchema` / `globalsSchema` where used).

## Reference locations

| Topic | Location |
|--------|----------|
| Catalogue list | `catalogue.ts`, re-exported from `index.ts` |
| Step metadata shape | `lib/workflows/engine/step-definition.ts` |
| Icons, groups, subtype helpers | `lib/workflows/engine/node-type-registry.ts` |
| Executor dispatch | `lib/workflows/engine/step-executor.ts` |
| Workflow constants helpers | `lib/workflows/workflow-constants.ts` |
| Canvas node registry | `lib/workflows/workflow-node-types.tsx` |
| Shared node chrome & handles | `shared/base-node.tsx`, `shared/handles.tsx` |
