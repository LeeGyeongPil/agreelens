// AC-3: boundary inputs give NA with a reason code (or the correct 0), never a made-up 0 and never an exception.
import { describe, expect, it } from 'vitest'
import { krippendorffAlpha } from '../../src/core/alpha'
import { analyze } from '../../src/core/analyze'
import { bootstrapCI } from '../../src/core/bootstrap'
import { kappaFromMatrix, percentAgreement } from '../../src/core/kappa'
import { mcnemar } from '../../src/core/mcnemar'
import ref from '../fixtures/ref.json'
import { mappingFor, rowsFrom } from '../helpers'

describe('kappa edge cases', () => {
  it('both raters use one and the same label -> NA (scikit-learn gives nan)', () => {
    expect(ref.edge.same_single_label_kappa).toBeNull()
    const r = analyze(rowsFrom({ human: Array(6).fill('pass'), judge: Array(6).fill('pass') }), mappingFor())
    expect(r.kappa.value).toBeNull()
    expect(r.kappa.reason).toBe('no_expected_disagreement')
    expect(r.agreement.value).toBe(1)
    expect(r.kappaCI?.used).toBe(0) // every resample is undefined, reported as dropped
    expect(r.kappaCI?.dropped).toBe(r.kappaCI?.iters)
    // kappa is NA, so neither the "kappa is 0" warning nor a judge prevalence warning may appear
    const codes = r.warnings.map((w) => w.code)
    expect(codes).not.toContain('judge_single_label')
    expect(r.warnings.some((w) => w.code === 'prevalence' && w.params.source === 'judge')).toBe(false)
  })

  it('humans use another single label than the judge -> kappa 0 and the warning stays', () => {
    const r = analyze(rowsFrom({ human: Array(40).fill('fail'), judge: Array(40).fill('pass') }), mappingFor())
    expect(r.kappa.value).toBeCloseTo(0, 12)
    expect(r.warnings.map((w) => w.code)).toContain('judge_single_label')
  })

  it('ordinal scale, same single label on both sides -> kappa and weighted kappa NA, no single-label warning', () => {
    const r = analyze(rowsFrom({ human: Array(10).fill('3'), judge: Array(10).fill('3') }), mappingFor(['human'], 'judge', { scale: 'ordinal' }))
    expect(r.kappa.value).toBeNull()
    expect(r.kappaLinear?.value).toBeNull()
    expect(r.warnings.map((w) => w.code)).not.toContain('judge_single_label')
  })

  it('only the judge uses one label -> kappa 0 like scikit-learn, plus the single-label warning', () => {
    expect(ref.edge.judge_single_label_kappa).toBe(0)
    const r = analyze(rowsFrom({ human: ['pass', 'fail', 'pass', 'fail'], judge: Array(4).fill('pass') }), mappingFor())
    expect(r.kappa.value).toBeCloseTo(0, 12)
    expect(r.warnings.map((w) => w.code)).toContain('judge_single_label')
    // MCC is not defined here (scikit-learn returns 0.0); we say NA with the reason instead of pretending
    expect(r.mcc?.value).toBeNull()
    expect(r.mcc?.reason).toBe('undefined')
  })

  it('no comparable row -> every statistic NA with reason no_rows, no exception', () => {
    const r = analyze(rowsFrom({ human: ['', 'NA', 'null'], judge: ['pass', 'fail', 'pass'] }), mappingFor())
    expect(r.n).toBe(0)
    for (const s of [r.agreement, r.kappa, r.mcc]) {
      expect(s?.value).toBeNull()
      expect(s?.reason).toBe('no_rows')
    }
    expect(r.kappaCI).toBeNull()
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['no_rows', 'excluded_rows']))
    expect(r.exclusions).toEqual({ total: 3, judgeMissing: 0, humanMissing: 3, tie: 0 })
  })

  it('empty matrix', () => {
    expect(kappaFromMatrix([]).reason).toBe('no_rows')
    expect(percentAgreement([]).reason).toBe('no_rows')
    expect(analyze([], mappingFor()).n).toBe(0)
  })

  it('blank cells are counted, not guessed', () => {
    const r = analyze(
      rowsFrom({ human: ['pass', '', 'fail', 'pass', 'fail'], judge: ['pass', 'pass', '', 'pass', 'fail'] }),
      mappingFor(),
    )
    expect(r.n).toBe(3)
    expect(r.exclusions).toEqual({ total: 2, judgeMissing: 1, humanMissing: 1, tie: 0 })
  })

  it('a tied human majority is left out and counted', () => {
    const rows = rowsFrom({ h1: ['pass', 'pass', 'fail'], h2: ['fail', 'pass', 'fail'], judge: ['pass', 'pass', 'fail'] })
    const r = analyze(rows, mappingFor(['h1', 'h2']))
    expect(r.exclusions.tie).toBe(1)
    expect(r.n).toBe(2)
  })
})

describe('alpha edge cases', () => {
  it('all values identical -> NA no_expected_disagreement', () => {
    const s = krippendorffAlpha([[1, 1, 1], [1, 1, 1]], 'nominal')
    expect(s).toEqual({ value: null, reason: 'no_expected_disagreement' })
  })
  it('no unit with two values -> NA no_pairable_units', () => {
    expect(krippendorffAlpha([[1, null], [null, 2]], 'nominal')).toEqual({ value: null, reason: 'no_pairable_units' })
    expect(krippendorffAlpha([], 'nominal').reason).toBe('no_pairable_units')
    expect(krippendorffAlpha([[], []], 'nominal').reason).toBe('no_pairable_units')
  })
})

describe('bootstrap edge cases', () => {
  it('undefined resamples are reported as dropped, not used as 0', () => {
    const human = ['pass', 'pass', 'pass', 'fail']
    const judge = ['pass', 'pass', 'pass', 'pass']
    const r = analyze(rowsFrom({ human, judge }), mappingFor())
    expect(r.kappaCI!.dropped).toBeGreaterThan(0)
    expect(r.kappaCI!.used + r.kappaCI!.dropped).toBe(r.kappaCI!.iters)
  })
  it('a statistic that is always undefined gives an empty interval', () => {
    const ci = bootstrapCI(5, () => null, 50, 1)
    expect(ci).toEqual({ lo: null, hi: null, used: 0, dropped: 50, iters: 50 })
  })
})

describe('McNemar edge cases', () => {
  it('b = c = 0 -> p = 1', () => {
    const m = mcnemar([true, false, true], [true, false, true])
    expect(m).toMatchObject({ b: 0, c: 0, exactP: 1, chi2: 0, chi2P: 1 })
  })
  it('empty input does not fail', () => {
    expect(mcnemar([], []).exactP).toBe(1)
  })
})
