// AC-5: the practice samples run through the real pipeline (parse -> map -> analyze) and teach what the README says.
import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/core/analyze'
import { parseTable } from '../../src/core/parse'
import { SAMPLES, sampleMapping } from '../../src/samples'
import ref from '../fixtures/ref.json'

function run(id: 'binary' | 'ordinal') {
  const s = SAMPLES[id]
  const table = parseTable(s.text, s.kind, s.fileName)
  expect(table.errors).toEqual([])
  return { table, result: analyze(table.rows, sampleMapping(id, table.fields)) }
}

describe('binary sample: high agreement, low kappa, lenient judge', () => {
  const { table, result } = run('binary')
  const r = ref.samples.binary

  it('shape: 200 rows, 3 left out (blank / NA cells), 197 compared', () => {
    expect(table.rows).toHaveLength(r.total)
    expect(result.n).toBe(r.n)
    expect(result.exclusions.total).toBe(3)
  })

  it('numbers equal the scikit-learn reference', () => {
    expect(result.kappa.value).toBeCloseTo(r.kappa, 12)
    expect(result.agreement.value).toBeCloseTo(r.accuracy, 12)
    expect(result.mcc?.value).toBeCloseTo(r.mcc, 12)
    expect(result.confusion.matrix).toEqual(r.confusion)
  })

  it('teaches the lesson: agreement >= 0.85 but kappa < 0.7, with the kappa-paradox warning', () => {
    expect(result.agreement.value!).toBeGreaterThanOrEqual(0.85)
    expect(result.kappa.value!).toBeLessThan(0.7)
    const prevalence = result.warnings.filter((w) => w.code === 'prevalence')
    expect(prevalence.length).toBeGreaterThan(0)
    expect(prevalence.some((w) => w.params.source === 'human')).toBe(true)
  })

  it('the judge is lenient more often than strict', () => {
    expect(result.direction).toMatchObject({ kind: 'binary', positive: 'pass', lenient: r.lenient, strict: r.strict })
    expect(r.lenient).toBeGreaterThan(r.strict)
  })

  it('messy spellings (Pass, " pass", PASS) fold into two labels', () => {
    expect(result.labels).toEqual(['fail', 'pass'])
    const raw = new Set(table.rows.map((x) => x.human))
    expect(raw.size).toBeGreaterThan(4) // the file really is messy
  })
})

describe('ordinal sample: off-by-one judge, three human raters', () => {
  const { result } = run('ordinal')
  const r = ref.samples.ordinal

  it('numbers equal the references', () => {
    expect(result.n).toBe(r.n)
    expect(result.kappa.value).toBeCloseTo(r.kappa, 12)
    expect(result.kappaLinear?.value).toBeCloseTo(r.kappa_linear, 12)
    expect(result.kappaQuadratic?.value).toBeCloseTo(r.kappa_quadratic, 12)
    expect(result.confusion.matrix).toEqual(r.confusion)
    const ordinal = result.alphas.find((a) => a.level === 'ordinal')!
    expect(ordinal.humans.value).toBeCloseTo(r.alpha.ordinal.humans, 10)
    expect(ordinal.withJudge.value).toBeCloseTo(r.alpha.ordinal.with_judge, 10)
    const interval = result.alphas.find((a) => a.level === 'interval')!
    expect(interval.humans.value).toBeCloseTo(r.alpha.interval.humans, 10)
    expect(interval.withJudge.value).toBeCloseTo(r.alpha.interval.with_judge, 10)
    result.perRater.forEach((p, i) => expect(p.kappa.value).toBeCloseTo(r.per_rater_kappa[i], 12))
    expect(result.direction).toMatchObject({ kind: 'ordinal' })
    if (result.direction?.kind === 'ordinal') expect(result.direction.meanDiff).toBeCloseTo(r.mean_diff, 12)
  })

  it('teaches the lesson: weighted kappa is much higher than unweighted kappa', () => {
    expect(result.kappaQuadratic!.value! - result.kappa.value!).toBeGreaterThanOrEqual(0.2)
  })

  it('humans agree with each other more than with the judge (the baseline)', () => {
    const ordinal = result.alphas.find((a) => a.level === 'ordinal')!
    expect(ordinal.humans.value!).toBeGreaterThan(ordinal.withJudge.value!)
  })

  it('no kappa-paradox warning (labels are not skewed), no warnings at all', () => {
    expect(result.warnings.map((w) => w.code)).not.toContain('prevalence')
    expect(result.warnings).toEqual([])
  })
})
