// AC-2: Krippendorff alpha, bootstrap CI and McNemar against reference values.
import { describe, expect, it } from 'vitest'
import { krippendorffAlpha } from '../../src/core/alpha'
import { bootstrapCI, defaultIters } from '../../src/core/bootstrap'
import { cohenKappa, confusionMatrix, kappaFromMatrix } from '../../src/core/kappa'
import { mcnemar } from '../../src/core/mcnemar'
import ref from '../fixtures/ref.json'

describe('Krippendorff alpha (2011 worked example, python krippendorff)', () => {
  const data = ref.kripp.data as (number | null)[][]
  it('matches the python package to 10 digits', () => {
    expect(krippendorffAlpha(data, 'nominal').value).toBeCloseTo(ref.kripp.nominal, 10)
    expect(krippendorffAlpha(data, 'ordinal').value).toBeCloseTo(ref.kripp.ordinal, 10)
    expect(krippendorffAlpha(data, 'interval').value).toBeCloseTo(ref.kripp.interval, 10)
    expect(krippendorffAlpha(data, 'ratio').value).toBeCloseTo(ref.kripp.ratio, 10)
  })
  it('matches the paper: 0.743 / 0.815 / 0.849 / 0.797', () => {
    expect(krippendorffAlpha(data, 'nominal').value).toBeCloseTo(0.743, 3)
    expect(krippendorffAlpha(data, 'ordinal').value).toBeCloseTo(0.815, 3)
    expect(krippendorffAlpha(data, 'interval').value).toBeCloseTo(0.849, 3)
    expect(krippendorffAlpha(data, 'ratio').value).toBeCloseTo(0.797, 3)
  })
  it('perfect agreement gives alpha 1 (the practice samples are checked end to end in samples.test.ts)', () => {
    expect(krippendorffAlpha([[1, 2, 3], [1, 2, 3]], 'nominal').value).toBeCloseTo(1, 12)
  })
})

describe('bootstrap CI', () => {
  const r = ref.binary
  const labels = r.labels
  const stat = (idx: number[]) => {
    const a = idx.map((i) => r.human[i])
    const b = idx.map((i) => r.judge[i])
    return kappaFromMatrix(confusionMatrix(a, b, labels)).value
  }
  it('is reproducible with the same seed and differs with another seed', () => {
    const one = bootstrapCI(r.human.length, stat, 500, 1)
    const two = bootstrapCI(r.human.length, stat, 500, 1)
    const other = bootstrapCI(r.human.length, stat, 500, 2)
    expect(two).toEqual(one)
    expect(other.lo).not.toBe(one.lo)
  })
  it('is within 0.03 of the numpy bootstrap interval', () => {
    const ci = bootstrapCI(r.human.length, stat, 2000, 1)
    expect(Math.abs(ci.lo! - r.boot_ci95[0])).toBeLessThan(0.03)
    expect(Math.abs(ci.hi! - r.boot_ci95[1])).toBeLessThan(0.03)
    expect(ci.used + ci.dropped).toBe(2000)
  })
  it('contains the point estimate', () => {
    const ci = bootstrapCI(r.human.length, stat, 1000, 1)
    const k = cohenKappa(r.human, r.judge).value!
    expect(ci.lo!).toBeLessThan(k)
    expect(ci.hi!).toBeGreaterThan(k)
  })
  it('keeps the resample count small for big files', () => {
    expect(defaultIters(200)).toBe(1000)
    expect(defaultIters(20000)).toBe(100)
    expect(defaultIters(0)).toBe(0)
  })
})

describe('McNemar vs statsmodels', () => {
  const r = ref.mcnemar
  it('counts, exact p and continuity-corrected chi-square', () => {
    const m = mcnemar(r.v1, r.v2)
    expect([m.b, m.c]).toEqual([r.table[0][1], r.table[1][0]])
    expect(m.exactP).toBeCloseTo(r.exact_p, 10)
    expect(m.chi2).toBeCloseTo(r.chi2_cc, 10)
    expect(m.chi2P).toBeCloseTo(r.chi2_cc_p, 6)
    expect(m.chi2P).toBeCloseTo(r.chi2_cc_p, 10)
  })
  it('rejects inputs of different length', () => {
    expect(() => mcnemar([true], [true, false])).toThrow(/same length/)
  })
})
