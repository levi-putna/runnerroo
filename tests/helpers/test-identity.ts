import { randomUUID } from "node:crypto"

/**
 * Builds a collision-resistant email and display name for Playwright auth flows.
 */
export function createEphemeralAuthIdentity({
  parallelIndex = 0,
}: {
  parallelIndex?: number
} = {}) {
  const slug = randomUUID().replace(/-/g, "").slice(0, 16)
  const suffix = parallelIndex > 0 ? `w${parallelIndex}` : ""
  const email = `e2e${suffix}+${slug}@e2e.example.test`.toLowerCase()
  const fullName = `E2E User ${slug.slice(0, 8)}`
  return { email, fullName }
}

/**
 * Short random suffix for password or display-name edits inside a single spec.
 */
export function randomSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 10)
}
