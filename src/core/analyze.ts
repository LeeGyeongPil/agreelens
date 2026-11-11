import { krippendorffAlpha } from './alpha'
import { bootstrapCI, defaultIters } from './bootstrap'
import { guessPositive } from './mapping'
import {
  cohenKappa,
  confusionMatrix,
  confusionResult,
  kappaFromMatrix,
  mccFromMatrix,
  percentAgreement,
  perLabelMetrics,
} from './kappa'
import { buildCanonicalizer, orderLabels } from './normalize'
import type {
  AgreementWarning,
  AlphaResult,
  AnalysisResult,
  AnalyzeOptions,
  Direction,
  ExclusionSummary,
  Level,
  Mapping,
  PerRaterKappa,
  PreparedRow,
  Stat,
} from './types'

/** Warn when the most common label covers at least this share (kappa gets unstable: "kappa paradox"). */
export const PREVALENCE_THRESHOLD = 0.85
/** Warn when fewer rows than this are comparable. */
export const SMALL_SAMPLE = 50
/** Default bootstrap seed (fixed so a report can be reproduced). */
export const DEFAULT_SEED = 1

const NA_ROWS: Stat = { value: null, reason: 'no_rows' }

function topShare(values: readonly string[]): { label: string; share: number } | null {
  if (values.length === 0) return null
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = ''
  let bestN = -1
  for (const [l, c] of counts) {
    if (c > bestN || (c === bestN && l < best)) {
      best = l
      bestN = c
    }
  }
  return { label: best, share: bestN / values.length }
}

/** Majority label among the non-missing labels; `tie` when the top count is shared. */
function majority(values: readonly (string | null)[]): { label: string | null; tie: boolean } {
  const counts = new Map<string, number>()
  for (const v of values) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1)
  if (counts.size === 0) return { label: null, tie: false }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return { label: null, tie: true }
  return { label: sorted[0][0], tie: false }
}

/**
 * Compare a judge column with one or more human columns.
 * Rows without a judge label, without any human label, or whose human majority is tied are left out
 * and counted in `exclusions` — they are never turned into a label.
 */
export function analyze(rows: readonly Record<string, string>[], mapping: Mapping, opts: AnalyzeOptions = {}): AnalysisResult {
  const columns = [...mapping.humanColumns, mapping.judgeColumn]
  const { numeric, canon } = buildCanonicalizer(rows, columns, mapping.normalize)
  const excluded = new Set(mapping.excludedLabels)
  const finalLabel = (raw: string | undefined): string | null => {
    const c = canon(raw)
    if (c === null || excluded.has(c)) return null
    const merged = mapping.merge[c] ?? c
    return excluded.has(merged) ? null : merged
  }

  const exclusions: ExclusionSummary = { total: 0, judgeMissing: 0, humanMissing: 0, tie: 0 }
  const prepared: PreparedRow[] = []
  const refCol = mapping.reference.kind === 'column' ? mapping.reference.column : null

  rows.forEach((row, index) => {
    const judge = finalLabel(row[mapping.judgeColumn])
    const human = mapping.humanColumns.map((c) => finalLabel(row[c]))
    if (judge === null) {
      exclusions.judgeMissing++
      return
    }
    let reference: string | null
    if (refCol !== null) {
      reference = human[mapping.humanColumns.indexOf(refCol)] ?? null
      if (reference === null) {
        exclusions.humanMissing++
        return
      }
    } else {
      const m = majority(human)
      if (m.label === null) {
        if (m.tie) exclusions.tie++
        else exclusions.humanMissing++
        return
      }
      reference = m.label
    }
    const idRaw = mapping.idColumn ? row[mapping.idColumn] : undefined
    prepared.push({ index, id: idRaw !== undefined && idRaw !== '' ? idRaw : String(index + 1), human, judge, reference })
  })
  exclusions.total = exclusions.judgeMissing + exclusions.humanMissing + exclusions.tie

  const n = prepared.length
  const labels = orderLabels(
    prepared.flatMap((r) => [r.reference, r.judge]),
    numeric,
    mapping.scale,
    mapping.order,
  )
  const matrix = confusionMatrix(
    prepared.map((r) => r.reference),
    prepared.map((r) => r.judge),
    labels,
  )
  const confusion = confusionResult(matrix, labels)
  const ordinal = mapping.scale === 'ordinal'

  const agreement = percentAgreement(matrix)
  const kappa = kappaFromMatrix(matrix, 'none')
  const kappaLinear = ordinal ? kappaFromMatrix(matrix, 'linear') : null
  const kappaQuadratic = ordinal ? kappaFromMatrix(matrix, 'quadratic') : null
  const mcc = labels.length <= 2 ? mccFromMatrix(matrix) : null

  // Bootstrap CI: resample rows with a fixed seed, recompute kappa from a small count matrix.
  const idxOf = new Map(labels.map((l, i) => [l, i]))
  const refIdx = prepared.map((r) => idxOf.get(r.reference)!)
  const judgeIdx = prepared.map((r) => idxOf.get(r.judge)!)
  const k = labels.length
  const iters = opts.bootstrapIters ?? defaultIters(n)
  const seed = opts.seed ?? DEFAULT_SEED
  const kappaOn = (w: 'none' | 'quadratic') => (sample: number[]): number | null => {
    const m = Array.from({ length: k }, () => new Array<number>(k).fill(0))
    for (const i of sample) m[refIdx[i]][judgeIdx[i]]++
    return kappaFromMatrix(m, w).value
  }
  const kappaCI = n > 0 && iters > 0 ? bootstrapCI(n, kappaOn('none'), iters, seed) : null
  const kappaQuadraticCI = ordinal && n > 0 && iters > 0 ? bootstrapCI(n, kappaOn('quadratic'), iters, seed) : null

  // Krippendorff alpha over all human columns (baseline) and with the judge as one more rater.
  // It uses EVERY input row (missing cells are simply missing values), so it does not depend on the
  // reference choice, on tie exclusion or on whether the judge labelled the row.
  const alphas: AlphaResult[] = []
  const perRater: PerRaterKappa[] = []
  if (mapping.humanColumns.length >= 2) {
    const allHuman = rows.map((row) => mapping.humanColumns.map((c) => finalLabel(row[c])))
    const allJudge = rows.map((row) => finalLabel(row[mapping.judgeColumn]))
    const allLabels = orderLabels(
      [...allHuman.flat(), ...allJudge].filter((x): x is string => x !== null),
      numeric,
      mapping.scale,
      mapping.order,
    )
    const rank = new Map(allLabels.map((l, i) => [l, i]))
    const code = (l: string | null): number | null => (l === null ? null : numeric ? Number(l) : rank.get(l)!)
    const humanData = mapping.humanColumns.map((_, j) => allHuman.map((h) => code(h[j])))
    const judgeData = allJudge.map(code)
    const levels: Level[] = ordinal ? (numeric ? ['ordinal', 'interval'] : ['ordinal']) : ['nominal']
    for (const level of levels) {
      alphas.push({
        level,
        humans: krippendorffAlpha(humanData, level),
        withJudge: krippendorffAlpha([...humanData, judgeData], level),
      })
    }
    // Each human against the judge, on every row where both exist (independent of the reference choice).
    mapping.humanColumns.forEach((col) => {
      const a: string[] = []
      const b: string[] = []
      for (const row of rows) {
        const h = finalLabel(row[col])
        const j = finalLabel(row[mapping.judgeColumn])
        if (h !== null && j !== null) {
          a.push(h)
          b.push(j)
        }
      }
      const ls = orderLabels([...a, ...b], numeric, mapping.scale, mapping.order)
      perRater.push({ column: col, n: a.length, kappa: a.length === 0 ? NA_ROWS : cohenKappa(a, b, 'none', ls) })
    })
  }

  // Direction of the judge's mistakes.
  let direction: Direction | null = null
  let positive: string | null = null
  if (n > 0) {
    if (ordinal && labels.length >= 2) {
      const val = (l: string): number => (numeric ? Number(l) : idxOf.get(l)!)
      let sum = 0
      let above = 0
      let below = 0
      let equal = 0
      for (const r of prepared) {
        const d = val(r.judge) - val(r.reference)
        sum += d
        if (d > 0) above++
        else if (d < 0) below++
        else equal++
      }
      direction = { kind: 'ordinal', meanDiff: sum / n, above, below, equal }
    } else if (!ordinal && labels.length === 2) {
      positive = mapping.positive !== null && labels.includes(mapping.positive) ? mapping.positive : guessPositive(labels)
      let lenient = 0
      let strict = 0
      for (const r of prepared) {
        if (r.reference !== positive && r.judge === positive) lenient++
        else if (r.reference === positive && r.judge !== positive) strict++
      }
      direction = { kind: 'binary', positive: positive!, lenient, strict }
    }
  }

  // Warnings.
  const warnings: AgreementWarning[] = []
  if (n === 0) warnings.push({ code: 'no_rows', severity: 'warn', params: {} })
  if (exclusions.total > 0) {
    warnings.push({
      code: 'excluded_rows',
      severity: 'info',
      params: { count: exclusions.total, judgeMissing: exclusions.judgeMissing, humanMissing: exclusions.humanMissing, tie: exclusions.tie },
    })
  }
  if (n > 0 && n < SMALL_SAMPLE) warnings.push({ code: 'small_sample', severity: 'warn', params: { n, min: SMALL_SAMPLE } })
  const refTop = topShare(prepared.map((r) => r.reference))
  const judgeTop = topShare(prepared.map((r) => r.judge))
  if (refTop && refTop.share >= PREVALENCE_THRESHOLD) {
    warnings.push({ code: 'prevalence', severity: 'warn', params: { source: 'human', label: refTop.label, share: refTop.share } })
  }
  const judgeLabels = new Set(prepared.map((r) => r.judge))
  if (n > 0 && judgeLabels.size === 1) {
    warnings.push({ code: 'judge_single_label', severity: 'warn', params: { label: prepared[0].judge } })
  } else if (judgeTop && judgeTop.share >= PREVALENCE_THRESHOLD) {
    warnings.push({ code: 'prevalence', severity: 'warn', params: { source: 'judge', label: judgeTop.label, share: judgeTop.share } })
  }

  return {
    n,
    totalRows: rows.length,
    exclusions,
    labels,
    numericLabels: numeric,
    scale: mapping.scale,
    rows: prepared,
    confusion,
    perLabel: perLabelMetrics(confusion),
    agreement,
    kappa,
    kappaCI,
    kappaLinear,
    kappaQuadratic,
    kappaQuadraticCI,
    mcc,
    alphas,
    perRater,
    direction,
    warnings,
    referenceDescription: refCol ? { kind: 'column', column: refCol } : { kind: 'majority' },
    positive,
  }
}
