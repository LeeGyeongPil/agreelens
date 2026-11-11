import type { ConfusionResult, LabelMetrics, Stat, Weights } from './types'

/** Sorted union of labels. Numbers sort numerically, everything else by code unit (like scikit-learn). */
export function labelsOf<T extends string | number>(a: readonly T[], b: readonly T[]): T[] {
  const s = Array.from(new Set<T>([...a, ...b]))
  return s.sort((x, y) =>
    typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0,
  )
}

/** Confusion matrix, rows = `a` (reference/human), columns = `b` (judge). */
export function confusionMatrix<T extends string | number>(
  a: readonly T[],
  b: readonly T[],
  labels: readonly T[] = labelsOf(a, b),
): number[][] {
  if (a.length !== b.length) {
    throw new Error(`confusionMatrix: inputs must have the same length (got ${a.length} and ${b.length})`)
  }
  const idx = new Map<T, number>(labels.map((l, i) => [l, i]))
  const m = labels.map(() => labels.map(() => 0))
  for (let i = 0; i < a.length; i++) {
    const r = idx.get(a[i])
    const c = idx.get(b[i])
    if (r === undefined || c === undefined) {
      throw new Error(`confusionMatrix: label "${String(r === undefined ? a[i] : b[i])}" is not in the label list`)
    }
    m[r][c] += 1
  }
  return m
}

export function confusionResult(matrix: number[][], labels: string[]): ConfusionResult {
  return {
    labels,
    matrix,
    rowTotals: matrix.map((r) => r.reduce((s, v) => s + v, 0)),
    colTotals: labels.map((_, j) => matrix.reduce((s, r) => s + r[j], 0)),
  }
}

export function percentAgreement(matrix: number[][]): Stat {
  const n = matrix.reduce((s, r) => s + r.reduce((x, v) => x + v, 0), 0)
  if (n === 0) return { value: null, reason: 'no_rows' }
  let diag = 0
  for (let i = 0; i < matrix.length; i++) diag += matrix[i][i]
  return { value: diag / n }
}

/** Cohen's kappa from a confusion matrix. The matrix order defines the weights (label rank). */
export function kappaFromMatrix(O: number[][], weights: Weights = 'none'): Stat {
  const k = O.length
  const row = O.map((r) => r.reduce((s, v) => s + v, 0))
  const col = O.map((_, j) => O.reduce((s, r) => s + r[j], 0))
  const n = row.reduce((s, v) => s + v, 0)
  if (n === 0) return { value: null, reason: 'no_rows' }
  let num = 0
  let den = 0
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = weights === 'none' ? (i === j ? 0 : 1) : weights === 'linear' ? Math.abs(i - j) : (i - j) ** 2
      num += w * O[i][j]
      den += (w * row[i] * col[j]) / n
    }
  }
  // den === 0: the expected disagreement is zero because both raters used one and the same label only.
  if (den === 0) return { value: null, reason: 'no_expected_disagreement' }
  return { value: 1 - num / den }
}

export function cohenKappa<T extends string | number>(
  a: readonly T[],
  b: readonly T[],
  weights: Weights = 'none',
  labels?: readonly T[],
): Stat {
  const ls = labels ?? labelsOf(a, b)
  return kappaFromMatrix(confusionMatrix(a, b, ls), weights)
}

/** Matthews correlation coefficient (multiclass form; equals the binary MCC for 2 labels). */
export function mccFromMatrix(O: number[][]): Stat {
  const n = O.reduce((s, r) => s + r.reduce((x, v) => x + v, 0), 0)
  if (n === 0) return { value: null, reason: 'no_rows' }
  const t = O.map((r) => r.reduce((s, v) => s + v, 0))
  const p = O.map((_, j) => O.reduce((s, r) => s + r[j], 0))
  let c = 0
  for (let i = 0; i < O.length; i++) c += O[i][i]
  const cov = c * n - t.reduce((s, v, i) => s + v * p[i], 0)
  const d1 = n * n - p.reduce((s, v) => s + v * v, 0)
  const d2 = n * n - t.reduce((s, v) => s + v * v, 0)
  if (d1 === 0 || d2 === 0) return { value: null, reason: 'undefined' }
  return { value: cov / Math.sqrt(d1 * d2) }
}

export function perLabelMetrics(c: ConfusionResult): LabelMetrics[] {
  return c.labels.map((label, i) => ({
    label,
    precision: c.colTotals[i] === 0 ? null : c.matrix[i][i] / c.colTotals[i],
    recall: c.rowTotals[i] === 0 ? null : c.matrix[i][i] / c.rowTotals[i],
    support: c.rowTotals[i],
  }))
}
