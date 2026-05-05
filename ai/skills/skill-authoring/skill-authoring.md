---
name: skill-authoring
description: Explain how repository skills in ai/skills are authored and when to add new markdown skills.
triggers:
  - add a skill
  - skill markdown
  - planning skill
  - ai/skills folder
---

When the user asks about **authoring or extending assistant skills** in this repository, point them at the markdown workflow under `ai/skills/<skill-name>/<skill-name>.md` with YAML frontmatter (`name`, `description`, `triggers`).

## Behaviour

- Repo skills are **static markdown** loaded by the planning pass (`runPlanningAgent`) when `RUNNER_ASSISTANT_PLANNING=true`.
- Prefer **updating an existing skill** when triggers overlap; add a new folder only when the use case is clearly distinct.
- User-specific “skills” stored in the database are **not** implemented yet; if the user asks for per-user skill records, describe that as a future feature and keep guidance in repo skills for now.

## Important distinction

- **Repo skills** (`ai/skills/...`) ship with the codebase and are version-controlled.
- **Future user skills** would be runtime records; do not pretend they already exist.
