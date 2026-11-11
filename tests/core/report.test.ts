// AC-8: JSON and HTML reports.
import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/core/analyze'
import { parseTable } from '../../src/core/parse'
import { buildNotesCsv } from '../../src/core/csv'
import { buildReport, toReportHtml, toReportJson } from '../../src/core/report'
import { MESSAGES } from '../../src/i18n/translate'
import { SAMPLES, sampleMapping } from '../../src/samples'

const s = SAMPLES.binary
const table = parseTable(s.text, s.kind, s.fileName)
const mapping = sampleMapping('binary', table.fields)
const result = analyze(table.rows, mapping)
const meta = { toolVersion: '9.9.9', fileName: s.fileName, generatedAt: '2026-11-11T00:00:00.000Z' }

describe('JSON report', () => {
  const json = JSON.parse(toReportJson(result, mapping, meta))
  it('has tool version, settings, stats and warnings', () => {
    expect(json.tool).toEqual({ name: 'agreelens', version: '9.9.9' })
    expect(json.settings.scale).toBe('nominal')
    expect(json.settings.reference).toEqual({ kind: 'majority' })
    expect(json.settings.missing.tokens).toContain('n/a')
    expect(json.settings.excludedRows.total).toBe(3)
    expect(json.settings.bootstrap).toEqual({ iters: 1000, seed: 1 })
    expect(json.stats.kappa.value).toBeCloseTo(result.kappa.value!, 12)
    expect(json.stats.kappa.ci.lo).toBeLessThan(json.stats.kappa.value)
    expect(json.stats.confusion.matrix).toEqual(result.confusion.matrix)
    expect(Array.isArray(json.stats.alpha)).toBe(true)
    expect(json.warnings.map((w: { code: string }) => w.code)).toContain('prevalence')
  })
  it('keeps NA as null with a reason instead of 0', () => {
    const empty = analyze([], mapping)
    const r = buildReport(empty, mapping, meta)
    expect(r.stats.kappa).toMatchObject({ value: null, reason: 'no_rows' })
  })
})

describe('HTML report', () => {
  for (const lang of ['en', 'ko'] as const) {
    it(`is self-contained and in ${lang}`, () => {
      const html = toReportHtml(result, mapping, MESSAGES[lang], lang, meta)
      expect(html).toContain(`<html lang="${lang}">`)
      expect(html).toContain(`<title>${MESSAGES[lang]['report.title']}</title>`)
      expect(html).toContain(MESSAGES[lang]['card.kappa'].replace(/'/g, '&#39;'))
      expect(html).toContain('0.59') // kappa of the binary sample
      // no external resources at all
      expect(html).not.toMatch(/\b(?:src|href)=["']?(?:https?:)?\/\//i)
      expect(html).not.toMatch(/<link\b/i)
      expect(html).not.toMatch(/<script\b/i)
      expect(html).not.toMatch(/https?:\/\//i)
    })
  }
  it('escapes text from the data', () => {
    const rows = [{ human: '<b>x</b>', judge: '<b>x</b>' }, { human: 'y', judge: 'y' }]
    const m = { ...mapping, humanColumns: ['human'], judgeColumn: 'judge', textColumns: [], idColumn: null }
    const html = toReportHtml(analyze(rows, m), m, MESSAGES.en, 'en', meta)
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('notes CSV', () => {
  it('lists disagreements with a note column; formula-looking cells are neutralized', () => {
    const first = result.rows.find((r) => r.reference !== r.judge)!
    const csv = buildNotesCsv(result, table.rows, mapping, { [String(first.index)]: '=HYPERLINK("x")' })
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('id,human,judge,question,answer,judge_reason,note')
    expect(lines).toHaveLength(1 + 16) // 12 lenient + 4 strict disagreements
    expect(csv).toContain("'=HYPERLINK")
  })
})
