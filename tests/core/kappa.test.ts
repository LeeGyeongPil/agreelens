// AC-1: Cohen's kappa (unweighted / linear / quadratic), confusion matrix, agreement and MCC
// against scikit-learn reference values (tests/fixtures/ref.json, made by scripts/make_ref.py).
import { describe, expect, it } from 'vitest'
import { cohenKappa, confusionMatrix, labelsOf, mccFromMatrix, percentAgreement } from '../../src/core/kappa'
import ref from '../fixtures/ref.json'

describe('binary pass/fail (200 rows, skewed)', () => {
  const r = ref.binary
  it('kappa matches scikit-learn to 12 digits', () => {
    expect(cohenKappa(r.human, r.judge).value).toBeCloseTo(r.kappa, 12)
  })
  it('confusion matrix is identical', () => {
    expect(confusionMatrix(r.human, r.judge, r.labels)).toEqual(r.confusion)
    expect(labelsOf(r.human, r.judge)).toEqual(r.labels)
  })
  it('agreement and MCC match', () => {
    const m = confusionMatrix(r.human, r.judge, r.labels)
    expect(percentAgreement(m).value).toBeCloseTo(r.accuracy, 12)
    expect(mccFromMatrix(m).value).toBeCloseTo(r.mcc, 12)
  })
})

describe('ordinal 1-5 (150 rows)', () => {
  const r = ref.ordinal
  it('unweighted, linear and quadratic kappa match to 12 digits', () => {
    expect(cohenKappa(r.human, r.judge).value).toBeCloseTo(r.kappa, 12)
    expect(cohenKappa(r.human, r.judge, 'linear').value).toBeCloseTo(r.kappa_linear, 12)
    expect(cohenKappa(r.human, r.judge, 'quadratic').value).toBeCloseTo(r.kappa_quadratic, 12)
  })
  it('confusion matrix is identical and agreement matches', () => {
    const m = confusionMatrix(r.human, r.judge, [1, 2, 3, 4, 5])
    expect(m).toEqual(r.confusion)
    expect(percentAgreement(m).value).toBeCloseTo(r.accuracy, 12)
  })
})

describe('three nominal classes', () => {
  const r = ref.multiclass
  it('kappa, MCC and matrix match', () => {
    const m = confusionMatrix(r.human, r.judge, r.labels)
    expect(m).toEqual(r.confusion)
    expect(cohenKappa(r.human, r.judge).value).toBeCloseTo(r.kappa, 12)
    expect(mccFromMatrix(m).value).toBeCloseTo(r.mcc, 12)
  })
})

describe('practice samples (values from the sample files)', () => {
  it('binary sample', () => {
    const r = ref.samples.binary
    const m = confusionMatrix(r.human, r.judge, r.labels)
    expect(m).toEqual(r.confusion)
    expect(cohenKappa(r.human, r.judge).value).toBeCloseTo(r.kappa, 12)
    expect(mccFromMatrix(m).value).toBeCloseTo(r.mcc, 12)
    expect(percentAgreement(m).value).toBeCloseTo(r.accuracy, 12)
  })
  it('ordinal sample', () => {
    const r = ref.samples.ordinal
    expect(cohenKappa(r.human, r.judge).value).toBeCloseTo(r.kappa, 12)
    expect(cohenKappa(r.human, r.judge, 'linear').value).toBeCloseTo(r.kappa_linear, 12)
    expect(cohenKappa(r.human, r.judge, 'quadratic').value).toBeCloseTo(r.kappa_quadratic, 12)
    expect(confusionMatrix(r.human, r.judge, [1, 2, 3, 4, 5])).toEqual(r.confusion)
  })
})

describe('input checks', () => {
  it('rejects inputs of different length with a clear message', () => {
    expect(() => confusionMatrix(['a'], ['a', 'b'])).toThrow(/same length/)
  })
  it('rejects labels that are not in the label list', () => {
    expect(() => confusionMatrix(['a'], ['z'], ['a'])).toThrow(/not in the label list/)
  })
})
