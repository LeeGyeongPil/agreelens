import Papa from 'papaparse'
import type { AnalysisResult, Mapping } from './types'

/** Spreadsheets run cells that start with = + - @ as formulas; prefix a quote so text stays text. */
function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

/**
 * CSV of the disagreements with the reviewer's notes: id, human, judge, text columns, note.
 * `rows` are the original table rows (PreparedRow.index points into them).
 */
export function buildNotesCsv(
  result: AnalysisResult,
  rows: readonly Record<string, string>[],
  mapping: Mapping,
  notes: Readonly<Record<string, string>>,
): string {
  const header = ['id', 'human', 'judge', ...mapping.textColumns, 'note']
  const body = result.rows
    .filter((r) => r.reference !== r.judge)
    .map((r) => [
      r.id,
      r.reference,
      r.judge,
      ...mapping.textColumns.map((c) => safeCell(rows[r.index]?.[c] ?? '')),
      safeCell(notes[String(r.index)] ?? ''),
    ])
  return Papa.unparse([header, ...body], { newline: '\n' }) + '\n'
}
