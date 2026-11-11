import { defaultNormalize } from './normalize'
import type { Mapping, MappingIssue } from './types'

const NOT_A_LABEL = /(reason|explain|rationale|comment|note|text|prompt|answer|question|response)/i
const HUMAN_NAME = /^(human|gold|label|truth|annot|rater|reference|expert|manual)/i
const JUDGE_NAME = /^(judge|pred|llm|model|auto|grader|evaluator)/i
const ID_NAME = /(^|[._-])(id|idx|index|uuid|key)$/i

const lastSegment = (name: string): string => name.split('.').pop() ?? name

/** Labels that usually mean "good / yes", used to choose the positive label of binary data. */
const POSITIVE_WORDS = ['pass', 'passed', 'yes', 'true', '1', 'good', 'correct', 'positive', 'safe', 'ok', 'accept', 'accepted', 'relevant', 'faithful', 'grounded']

export function guessPositive(labels: readonly string[]): string | null {
  if (labels.length === 0) return null
  const hit = labels.find((l) => POSITIVE_WORDS.includes(l.toLowerCase()))
  return hit ?? labels[labels.length - 1]
}

/** Default mapping with nothing selected. */
export function emptyMapping(): Mapping {
  return {
    idColumn: null,
    humanColumns: [],
    judgeColumn: '',
    textColumns: [],
    scale: 'nominal',
    order: null,
    reference: { kind: 'majority' },
    positive: null,
    normalize: defaultNormalize(),
    merge: {},
    excludedLabels: [],
  }
}

/** Guess which column plays which role from the column names. */
export function guessMapping(fields: readonly string[]): Mapping {
  const m = emptyMapping()
  const labelLike = (re: RegExp) => fields.filter((f) => re.test(lastSegment(f)) && !NOT_A_LABEL.test(lastSegment(f)))
  m.humanColumns = labelLike(HUMAN_NAME)
  const judges = labelLike(JUDGE_NAME).filter((f) => !m.humanColumns.includes(f))
  m.judgeColumn = judges[0] ?? fields.find((f) => /^score$/i.test(lastSegment(f)) && !m.humanColumns.includes(f)) ?? ''
  m.idColumn = fields.find((f) => ID_NAME.test(lastSegment(f))) ?? null
  const used = new Set<string>([...m.humanColumns, m.judgeColumn, m.idColumn ?? ''])
  m.textColumns = fields.filter((f) => !used.has(f))
  return m
}

/** Problems that make the mapping unusable. The UI shows them (translated) next to the column pickers. */
export function validateMapping(fields: readonly string[], m: Mapping): MappingIssue[] {
  const issues: MappingIssue[] = []
  const known = new Set(fields)
  if (m.humanColumns.length === 0) issues.push({ code: 'no_human_column' })
  if (m.judgeColumn === '') issues.push({ code: 'no_judge_column' })
  for (const c of [...m.humanColumns, m.judgeColumn, ...(m.idColumn ? [m.idColumn] : []), ...m.textColumns]) {
    if (c !== '' && !known.has(c)) issues.push({ code: 'unknown_column', column: c })
  }
  if (m.judgeColumn !== '' && m.humanColumns.includes(m.judgeColumn)) issues.push({ code: 'judge_in_humans', column: m.judgeColumn })
  if (m.reference.kind === 'column' && !m.humanColumns.includes(m.reference.column)) {
    issues.push({ code: 'reference_column_not_human', column: m.reference.column })
  }
  return issues
}
