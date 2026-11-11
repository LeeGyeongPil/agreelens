import Papa from 'papaparse'
import type { ParseIssue, ParsedTable } from './types'

export type TableKind = 'csv' | 'tsv' | 'jsonl'

/** Guess the file kind from the file name first, then from the content. */
export function detectKind(fileName: string, text: string): TableKind {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'jsonl'
  if (lower.endsWith('.tsv') || lower.endsWith('.tab')) return 'tsv'
  if (lower.endsWith('.csv')) return 'csv'
  const body = stripBom(text).trimStart()
  if (body.startsWith('{')) return 'jsonl'
  const firstLine = body.split(/\r?\n/, 1)[0] ?? ''
  const tabs = firstLine.split('\t').length - 1
  const commas = firstLine.split(',').length - 1
  return tabs > commas ? 'tsv' : 'csv'
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Flatten nested JSON objects into dot paths: {scores:{judge:1}} -> {"scores.judge": "1"} */
function flatten(value: unknown, prefix: string, out: Record<string, string>): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
    return
  }
  if (value === null || value === undefined) out[prefix] = ''
  else if (Array.isArray(value)) out[prefix] = JSON.stringify(value)
  else out[prefix] = String(value)
}

function parseJsonl(text: string): ParsedTable {
  const errors: ParseIssue[] = []
  const rows: Record<string, string>[] = []
  const fields: string[] = []
  const seen = new Set<string>()
  const lines = stripBom(text).split(/\r?\n/)
  lines.forEach((line, i) => {
    if (line.trim() === '') return
    let obj: unknown
    try {
      obj = JSON.parse(line)
    } catch (e) {
      errors.push({ code: 'jsonl_line', row: i + 1, detail: e instanceof Error ? e.message : String(e) })
      return
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      errors.push({ code: 'jsonl_not_object', row: i + 1 })
      return
    }
    const flat: Record<string, string> = {}
    flatten(obj, '', flat)
    for (const k of Object.keys(flat)) {
      if (!seen.has(k)) {
        seen.add(k)
        fields.push(k)
      }
    }
    rows.push(flat)
  })
  return { kind: 'jsonl', fields, rows, errors }
}

function parseDelimited(text: string, kind: 'csv' | 'tsv'): ParsedTable {
  const res = Papa.parse<Record<string, string>>(stripBom(text), {
    header: true,
    delimiter: kind === 'tsv' ? '\t' : ',',
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const errors: ParseIssue[] = res.errors.map((e) => ({
    code: 'csv_row' as const,
    row: typeof e.row === 'number' ? e.row + 1 : undefined,
    detail: e.message,
    reason: e.code,
  }))
  const fields = (res.meta.fields ?? []).filter((f) => f !== '')
  const rows = res.data.map((r) => {
    const out: Record<string, string> = {}
    for (const f of fields) out[f] = r[f] ?? ''
    return out
  })
  return { kind, fields, rows, errors }
}

/**
 * Parse CSV / TSV / JSONL text into a table of strings.
 * All values stay strings so that CSV "1" and JSONL 1 become the same label later.
 */
export function parseTable(text: string, kind?: TableKind, fileName = ''): ParsedTable {
  const k = kind ?? detectKind(fileName, text)
  if (stripBom(text).trim() === '') return { kind: k, fields: [], rows: [], errors: [{ code: 'empty_file' }] }
  const table = k === 'jsonl' ? parseJsonl(text) : parseDelimited(text, k)
  if (table.fields.length === 0 && table.errors.length === 0) table.errors.push({ code: 'no_columns' })
  if (table.rows.length === 0 && table.errors.length === 0) table.errors.push({ code: 'no_rows' })
  return table
}
