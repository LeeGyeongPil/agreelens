export interface McNemarResult {
  /** only version 1 correct */
  b: number
  /** only version 2 correct */
  c: number
  exactP: number
  /** chi-square with continuity correction */
  chi2: number
  chi2P: number
}

const LN_SQRT_PI = Math.log(Math.sqrt(Math.PI))

/** Regularized upper incomplete gamma Q(1/2, x) = erfc(sqrt(x)); series / continued fraction (about 1e-15 accurate). */
function gammaQHalf(x: number): number {
  if (x <= 0) return 1
  const a = 0.5
  if (x < a + 1) {
    let ap = a
    let sum = 1 / a
    let del = sum
    for (let n = 0; n < 500; n++) {
      ap += 1
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-16) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - LN_SQRT_PI)
  }
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  return Math.exp(-x + a * Math.log(x) - LN_SQRT_PI) * h
}

/**
 * McNemar test on the paired correctness of two judge versions (same items).
 * Exact p is the two-sided binomial test; chi2 uses the continuity correction.
 * b = c = 0 gives p = 1.
 */
export function mcnemar(v1Correct: readonly boolean[], v2Correct: readonly boolean[]): McNemarResult {
  if (v1Correct.length !== v2Correct.length) {
    throw new Error(`mcnemar: inputs must have the same length (got ${v1Correct.length} and ${v2Correct.length})`)
  }
  let b = 0
  let c = 0
  for (let i = 0; i < v1Correct.length; i++) {
    if (v1Correct[i] && !v2Correct[i]) b++
    else if (!v1Correct[i] && v2Correct[i]) c++
  }
  const n = b + c
  const lo = Math.min(b, c)
  // Sum of the Binomial(n, 1/2) pmf for i = 0..lo, accumulated in log space.
  let logC = 0
  let cdf = Math.exp(-n * Math.LN2)
  for (let i = 1; i <= lo; i++) {
    logC += Math.log(n - i + 1) - Math.log(i)
    cdf += Math.exp(logC - n * Math.LN2)
  }
  const exactP = Math.min(1, 2 * cdf)
  const chi2 = n === 0 ? 0 : (Math.abs(b - c) - 1) ** 2 / n
  return { b, c, exactP, chi2, chi2P: n === 0 ? 1 : gammaQHalf(chi2 / 2) }
}
