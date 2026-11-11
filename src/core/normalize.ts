import type { NormalizeOptions, Scale } from './types'

export const DEFAULT_MISSING_TOKENS = ['', 'na', 'n/a', 'null']

export function defaultNormalize(): NormalizeOptions {
  return { trim: true, caseInsensitive: true, missingTokens: [...DEFAULT_MISSING_TOKENS] }
}

export function isNumericString(s: string): boolean {
  return s.trim() !== '' && Number.isFinite(Number(s))
}

export function isMissingToken(raw: string, tokens: readonly string[]): boolean {
  const v = raw.trim().toLowerCase()
  return tokens.some((t) => t.trim().toLowerCase() === v)
}

/** Whitespace/case handling and missing detection for one cell. Returns null for a missing cell. */
function normalizeCell(raw: string | undefined, opt: NormalizeOptions): string | null {
  if (raw === undefined || raw === null) return null
  if (isMissingToken(raw, opt.missingTokens)) return null
  let s = opt.trim ? raw.trim() : raw
  if (opt.caseInsensitive) s = s.toLowerCase()
  return s
}

export interface Canonicalizer {
  /** true when every non-missing value in the inspected columns is a number */
  numeric: boolean
  canon: (raw: string | undefined) => string | null
}

/**
 * Build the cell -> canonical label function for a set of columns.
 * If every value is a number the labels become canonical numbers ("1.0" and "1" are the same label),
 * so CSV "1" and JSONL 1 agree.
 */
export function buildCanonicalizer(rows: readonly Record<string, string>[], columns: readonly string[], opt: NormalizeOptions): Canonicalizer {
  let seen = 0
  let allNumeric = true
  for (const r of rows) {
    for (const c of columns) {
      const v = normalizeCell(r[c], opt)
      if (v === null) continue
      seen++
      if (!isNumericString(v)) allNumeric = false
    }
  }
  const numeric = seen > 0 && allNumeric
  return {
    numeric,
    canon: (raw) => {
      const v = normalizeCell(raw, opt)
      if (v === null) return null
      return numeric ? String(Number(v)) : v
    },
  }
}

export interface LabelSummary {
  label: string
  /** raw spellings that were folded into this label */
  variants: string[]
  count: number
}

/** Distinct canonical labels with their raw spellings and counts (for the label table). */
export function summarizeLabels(
  rows: readonly Record<string, string>[],
  columns: readonly string[],
  opt: NormalizeOptions,
): { numeric: boolean; labels: LabelSummary[]; missing: number } {
  const { numeric, canon } = buildCanonicalizer(rows, columns, opt)
  const map = new Map<string, { variants: Set<string>; count: number }>()
  let missing = 0
  for (const r of rows) {
    for (const c of columns) {
      const raw = r[c]
      const l = canon(raw)
      if (l === null) {
        missing++
        continue
      }
      const e = map.get(l) ?? { variants: new Set<string>(), count: 0 }
      e.variants.add(raw)
      e.count++
      map.set(l, e)
    }
  }
  const labels = orderLabels(Array.from(map.keys()), numeric, 'nominal', null).map((label) => ({
    label,
    variants: Array.from(map.get(label)!.variants),
    count: map.get(label)!.count,
  }))
  return { numeric, labels, missing }
}

/**
 * Label order used for weights, alpha and the matrix.
 * numeric labels: ascending numbers; nominal: alphabetical; ordinal text labels: the user's order first
 * (labels the user did not place follow alphabetically).
 */
export function orderLabels(labels: readonly string[], numeric: boolean, scale: Scale, order: readonly string[] | null): string[] {
  const uniq = Array.from(new Set(labels))
  if (numeric) return uniq.sort((a, b) => Number(a) - Number(b))
  const alpha = uniq.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  if (scale !== 'ordinal' || !order) return alpha
  const placed = order.filter((l) => uniq.includes(l))
  return [...placed, ...alpha.filter((l) => !placed.includes(l))]
}
