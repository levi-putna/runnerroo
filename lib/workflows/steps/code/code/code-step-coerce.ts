export type CodeStepOutputType = "string" | "number" | "json" | "null"

export interface CoerceCodeStepOutputParams {
  raw: unknown
  outputType: CodeStepOutputType
}

/**
 * Coerces the parsed stdout payload to the author-selected output type.
 */
export function coerceCodeStepOutput({ raw, outputType }: CoerceCodeStepOutputParams): unknown {
  switch (outputType) {
    case "null":
      if (raw === undefined || raw === null) return null
      if (typeof raw === "string" && raw.trim() === "") return null
      return raw

    case "string":
      if (raw === undefined || raw === null) return ""
      if (typeof raw === "string") return raw
      if (typeof raw === "number" || typeof raw === "boolean") return String(raw)
      try {
        return JSON.stringify(raw)
      } catch {
        return String(raw)
      }

    case "number": {
      if (raw === undefined || raw === null) return NaN
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN
      if (typeof raw === "boolean") return raw ? 1 : 0
      if (typeof raw === "string") {
        const n = Number(raw.trim())
        return Number.isFinite(n) ? n : NaN
      }
      return NaN
    }

    case "json":
    default:
      return raw
  }
}
