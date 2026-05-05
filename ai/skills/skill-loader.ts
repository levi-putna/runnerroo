import fs from "fs";
import path from "path";

export interface SkillMeta {
  /** Skill identifier (matches folder and file name) */
  name: string;
  /** One-line description used by the planning agent to decide relevance */
  description: string;
  /** Keywords that hint when this skill is relevant */
  triggers: string[];
  /** Raw markdown content (including frontmatter) */
  raw: string;
  /** Markdown body with frontmatter stripped */
  body: string;
}

const SKILLS_DIR = path.join(process.cwd(), "ai", "skills");

/**
 * Parses YAML-style frontmatter from a markdown string.
 * Returns the parsed key-value pairs and the remaining body.
 */
function parseFrontmatter(raw: string): {
  attrs: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { attrs: {}, body: raw };

  const attrs: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();

    // List item continuation
    if (trimmed.startsWith("- ") && currentKey && currentList !== null) {
      currentList.push(trimmed.slice(2).trim());
      continue;
    }

    // Flush any accumulated list
    if (currentKey && currentList !== null) {
      attrs[currentKey] = currentList;
      currentList = null;
      currentKey = null;
    }

    // Key: value pair
    const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (value === "" || value === undefined) {
        // Might be followed by a list
        currentKey = key;
        currentList = [];
      } else {
        attrs[key] = value;
      }
    }
  }

  // Flush trailing list
  if (currentKey && currentList !== null) {
    attrs[currentKey] = currentList;
  }

  return { attrs, body: match[2].trim() };
}

/**
 * Scans ai/skills/ for subdirectories containing a markdown skill file.
 * Each skill lives in its own folder: `ai/skills/<name>/<name>.md` (frontmatter: name, description, triggers).
 */
export function loadAllSkills(): SkillMeta[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const mdPath = path.join(SKILLS_DIR, entry.name, `${entry.name}.md`);
    if (!fs.existsSync(mdPath)) continue;

    const raw = fs.readFileSync(mdPath, "utf-8");
    const { attrs, body } = parseFrontmatter(raw);

    skills.push({
      name: (attrs.name as string) ?? entry.name,
      description: (attrs.description as string) ?? "",
      triggers: Array.isArray(attrs.triggers)
        ? (attrs.triggers as string[])
        : [],
      raw,
      body,
    });
  }

  return skills;
}

/**
 * Returns a skill by name, or undefined if not found.
 */
export function loadSkill(name: string): SkillMeta | undefined {
  return loadAllSkills().find((s) => s.name === name);
}

/**
 * Builds a compact summary of all available skills for the planning agent.
 */
export function buildSkillSummary(): string {
  const skills = loadAllSkills();
  if (skills.length === 0) return "No skills available.";

  return skills
    .map(
      (s) =>
        `- **${s.name}**: ${s.description}${s.triggers.length > 0 ? ` (triggers: ${s.triggers.join(", ")})` : ""}`
    )
    .join("\n");
}
