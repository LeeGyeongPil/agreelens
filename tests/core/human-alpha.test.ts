// AC-2 (regression Q-1): the human-only alpha baseline uses every row, not only the rows kept for the judge comparison.
// Reference values come from the python `krippendorff` package (scripts/make_ref.py, fixture ref.json).
import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/core/analyze'
import ref from '../fixtures/ref.json'
import { mappingFor, rowsFrom } from '../helpers'

type Case = { humans: (string | null)[][]; judge: (string | null)[]; alpha_humans: number; alpha_with_judge: number }

function rowsOf(c: Case, names: string[]) {
  const cols: Record<string, string[]> = {}
  names.forEach((n, i) => (cols[n] = c.humans[i].map((v) => v ?? '')))
  cols.judge = c.judge.map((v) => v ?? '')
  return rowsFrom(cols)
}

describe('alpha among humans equals the krippendorff reference on all rows', () => {
  const two = ref.alpha_two_humans as Case
  const three = ref.alpha_three_humans as Case

  it('two humans: disagreements are not dropped (baseline is not 1)', () => {
    const r = analyze(rowsOf(two, ['h1', 'h2']), mappingFor(['h1', 'h2']))
    expect(r.exclusions.tie).toBeGreaterThan(0)
    expect(r.alphas[0].humans.value).toBeCloseTo(two.alpha_humans, 10)
    expect(r.alphas[0].humans.value).toBeLessThan(0.5)
    expect(r.alphas[0].withJudge.value).toBeCloseTo(two.alpha_with_judge, 10)
  })

  it('three humans with ties, gaps and missing judge labels', () => {
    const r = analyze(rowsOf(three, ['h1', 'h2', 'h3']), mappingFor(['h1', 'h2', 'h3']))
    expect(r.alphas[0].humans.value).toBeCloseTo(three.alpha_humans, 10)
    expect(r.alphas[0].withJudge.value).toBeCloseTo(three.alpha_with_judge, 10)
  })

  it('does not depend on the reference column or on the judge column', () => {
    const rows = rowsOf(two, ['h1', 'h2'])
    const byColumn = analyze(rows, mappingFor(['h1', 'h2'], 'judge', { reference: { kind: 'column', column: 'h1' } }))
    expect(byColumn.alphas[0].humans.value).toBeCloseTo(two.alpha_humans, 10)
    const noJudge = rows.map((r) => ({ ...r, judge: '' }))
    const res = analyze(noJudge, mappingFor(['h1', 'h2']))
    expect(res.alphas[0].humans.value).toBeCloseTo(two.alpha_humans, 10)
  })
})
