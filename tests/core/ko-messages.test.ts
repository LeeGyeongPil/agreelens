// Q-3: Korean messages say what the English ones say, and CSV problems are translated rather than showing parser text.
import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/core/analyze'
import { parseTable } from '../../src/core/parse'
import { toReportHtml } from '../../src/core/report'
import { MESSAGES } from '../../src/i18n/translate'
import { mappingFor, rowsFrom } from '../helpers'

describe('Korean message fixes', () => {
  it('no_pairable_units says no row has two or more values (not the opposite)', () => {
    expect(MESSAGES.ko['na.no_pairable_units']).toContain('값이 두 개 이상 있는 행이 없어')
  })

  it('CSV parser codes map to translated messages in both languages', () => {
    const t = parseTable('human,judge\npass\nfail,pass,extra\n', 'csv')
    const reasons = t.errors.map((e) => e.reason)
    expect(reasons).toContain('TooFewFields')
    expect(reasons).toContain('TooManyFields')
    for (const lang of ['en', 'ko'] as const) {
      for (const r of ['TooFewFields', 'TooManyFields', 'MissingQuotes', 'InvalidQuotes', 'UndetectableDelimiter']) {
        expect(MESSAGES[lang][`err.csv_row.${r}` as keyof typeof MESSAGES.en]).toBeTruthy()
      }
    }
    expect(MESSAGES.ko['err.csv_row.TooFewFields']).not.toMatch(/[A-Za-z]{4,} fields/)
  })

  it('report shows alpha level and scale in Korean', () => {
    const rows = rowsFrom({ h1: [1, 2, 3, 4], h2: [1, 2, 3, 3], judge: [1, 2, 3, 4] })
    const res = analyze(rows, mappingFor(['h1', 'h2'], 'judge', { scale: 'ordinal' }))
    const html = toReportHtml(res, mappingFor(['h1', 'h2'], 'judge', { scale: 'ordinal' }), MESSAGES.ko, 'ko', { toolVersion: '0', generatedAt: '2026-01-01T00:00:00Z' })
    expect(html).toContain('순서형')
    expect(html).not.toContain('척도: ordinal')
  })
})
