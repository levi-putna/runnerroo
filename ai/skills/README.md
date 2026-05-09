# Skills (`ai/skills/`)

## Repo skills (markdown)

Each skill is a folder with a matching markdown file:

`ai/skills/<skill-name>/<skill-name>.md`

Frontmatter (YAML between `---` lines):

- `name` — identifier returned by the planning model (must match the folder name in practice).
- `description` — one line for the planning prompt.
- `triggers` — bullet list of phrases that indicate relevance.

The planning agent (`runPlanningAgent`) loads summaries from all valid skill files; when it selects a skill, the full markdown **body** is injected into the system prompt via `buildRunnerAssistantInstructions`.

## TypeScript fragments

Small strings composed in `index.ts`:

- `dailify-domain.ts` — product framing.
- `tone.ts` — voice and clarity.
- `tool-behaviour.ts` — how to use the current tool pack safely.

## Loader

`skill-loader.ts` scans the directory at **build/runtime on the server** (Node `fs`). Do not import it from client components.
