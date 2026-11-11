// Shared types for the agreement statistics core. Nothing in src/core depends on React or the DOM.

export type Weights = 'none' | 'linear' | 'quadratic'
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export type Scale = 'nominal' | 'ordinal'

/** Why a statistic is not available. A statistic is never silently turned into 0. */
export type NaReason =
  | 'no_rows' // no comparable rows at all
  | 'no_expected_disagreement' // kappa/alpha denominator is 0 (everyone used one and the same label)
  | 'no_pairable_units' // alpha: no unit has two or more values
  | 'undefined' // e.g. MCC with an empty marginal
  | 'too_few_raters' // alpha needs at least two raters

export interface Stat {
  value: number | null
  reason?: NaReason
}

export interface BootstrapCI {
  lo: number | null
  hi: number | null
  /** resamples whose statistic was defined */
  used: number
  /** resamples whose statistic was NaN/undefined and were left out */
  dropped: number
  iters: number
}

export interface ParseIssue {
  code: 'empty_file' | 'no_columns' | 'csv_row' | 'jsonl_line' | 'jsonl_not_object' | 'no_rows' | 'read_failed'
  /** 1-based row (CSV) or line (JSONL) number */
  row?: number
  detail?: string
  /** CSV parser error code (e.g. TooFewFields), used to pick a translated message */
  reason?: string
}

export interface ParsedTable {
  kind: 'csv' | 'tsv' | 'jsonl'
  fields: string[]
  rows: Record<string, string>[]
  errors: ParseIssue[]
}

export interface NormalizeOptions {
  trim: boolean
  caseInsensitive: boolean
  /** compared after trimming and lower-casing */
  missingTokens: string[]
}

export type ReferenceChoice = { kind: 'majority' } | { kind: 'column'; column: string }

export interface Mapping {
  idColumn: string | null
  humanColumns: string[]
  judgeColumn: string
  textColumns: string[]
  scale: Scale
  /** ordinal order of non-numeric labels (canonical labels, lowest first). Ignored when all labels are numbers. */
  order: string[] | null
  reference: ReferenceChoice
  /** positive label for binary data (decides lenient/strict direction) */
  positive: string | null
  normalize: NormalizeOptions
  /** canonical label -> canonical label it is merged into */
  merge: Record<string, string>
  /** canonical labels treated as missing */
  excludedLabels: string[]
}

export type MappingIssueCode =
  | 'no_human_column'
  | 'no_judge_column'
  | 'judge_in_humans'
  | 'unknown_column'
  | 'reference_column_not_human'

export interface MappingIssue {
  code: MappingIssueCode
  column?: string
}

export interface ConfusionResult {
  labels: string[]
  /** matrix[humanIndex][judgeIndex] */
  matrix: number[][]
  rowTotals: number[]
  colTotals: number[]
}

export interface LabelMetrics {
  label: string
  /** share of the judge's `label` answers that the reference also labelled `label` */
  precision: number | null
  /** share of the reference's `label` rows that the judge also labelled `label` */
  recall: number | null
  support: number
}

export type Direction =
  | { kind: 'binary'; positive: string; lenient: number; strict: number }
  | { kind: 'ordinal'; meanDiff: number | null; above: number; below: number; equal: number }

export type WarningCode = 'prevalence' | 'judge_single_label' | 'no_rows' | 'small_sample' | 'excluded_rows'

export interface AgreementWarning {
  code: WarningCode
  severity: 'info' | 'warn'
  params: Record<string, string | number>
}

export interface ExclusionSummary {
  total: number
  judgeMissing: number
  humanMissing: number
  tie: number
}

export interface AlphaResult {
  level: Level
  humans: Stat
  withJudge: Stat
}

export interface PerRaterKappa {
  column: string
  n: number
  kappa: Stat
}

export interface PreparedRow {
  /** index into the original rows array */
  index: number
  id: string
  human: (string | null)[]
  judge: string
  reference: string
}

export interface AnalysisResult {
  n: number
  totalRows: number
  exclusions: ExclusionSummary
  labels: string[]
  numericLabels: boolean
  scale: Scale
  rows: PreparedRow[]
  confusion: ConfusionResult
  perLabel: LabelMetrics[]
  agreement: Stat
  kappa: Stat
  kappaCI: BootstrapCI | null
  kappaLinear: Stat | null
  kappaQuadratic: Stat | null
  kappaQuadraticCI: BootstrapCI | null
  mcc: Stat | null
  alphas: AlphaResult[]
  perRater: PerRaterKappa[]
  direction: Direction | null
  warnings: AgreementWarning[]
  referenceDescription: { kind: 'majority' | 'column'; column?: string }
  /** the label that counts as "positive" for binary data */
  positive: string | null
}

export interface AnalyzeOptions {
  /** bootstrap resamples; default depends on N (at most 1000) */
  bootstrapIters?: number
  seed?: number
}
