---
name: workflow-builder
description: Help users design, wire, and debug workflow graphs (nodes, edges, inputs, and execution).
triggers:
  - workflow
  - automation graph
  - node
  - edge
  - trigger
  - run failed
  - debug workflow
---

# Workflow builder

Use this skill when the user is reasoning about **workflow structure**, **node configuration**, **run failures**, or **how steps connect**.

## Guidance

- Prefer concrete steps: which node runs first, what data each step expects, and how errors surface in the run timeline.
- When suggesting TypeScript for custom steps, keep examples small and typed; avoid large speculative refactors.
- If the user has not shared the error text or node name, ask for that before guessing.

## Out of scope

- Do not claim to change saved workflows unless a tool or UI action confirms it.
