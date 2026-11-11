import type { Level, Stat } from './types'

/**
 * Krippendorff's alpha. `data[rater][unit]`, null = missing.
 * Returns NA (never 0) when it is not defined:
 *  - no unit has two or more values -> no_pairable_units
 *  - every value is identical       -> no_expected_disagreement
 */
export function krippendorffAlpha(data: readonly (readonly (number | null)[])[], level: Level): Stat {
  if (data.length === 0 || data[0].length === 0) return { value: null, reason: 'no_pairable_units' }
  const values = Array.from(new Set(data.flat().filter((v): v is number => v !== null))).sort((x, y) => x - y)
  const vi = new Map(values.map((v, i) => [v, i]))
  const K = values.length
  const o = values.map(() => values.map(() => 0))
  const units = data[0].length
  let pairable = 0
  for (let u = 0; u < units; u++) {
    const vs: number[] = []
    for (const r of data) {
      const v = r[u]
      if (v !== null && v !== undefined) vs.push(v)
    }
    const m = vs.length
    if (m < 2) continue
    pairable += m
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) if (i !== j) o[vi.get(vs[i])!][vi.get(vs[j])!] += 1 / (m - 1)
    }
  }
  if (pairable === 0) return { value: null, reason: 'no_pairable_units' }
  const nc = o.map((r) => r.reduce((s, v) => s + v, 0))
  const n = nc.reduce((s, v) => s + v, 0)
  const d2 = (c: number, k: number): number => {
    if (level === 'nominal') return c === k ? 0 : 1
    const a = values[c]
    const b = values[k]
    if (level === 'interval') return (a - b) ** 2
    if (level === 'ratio') return a + b === 0 ? 0 : ((a - b) / (a + b)) ** 2
    const lo = Math.min(c, k)
    const hi = Math.max(c, k)
    let s = 0
    for (let g = lo; g <= hi; g++) s += nc[g]
    return (s - (nc[c] + nc[k]) / 2) ** 2
  }
  let Do = 0
  let De = 0
  for (let c = 0; c < K; c++) {
    for (let k = 0; k < K; k++) {
      const d = d2(c, k)
      Do += o[c][k] * d
      De += nc[c] * nc[k] * d
    }
  }
  if (De === 0) return { value: null, reason: 'no_expected_disagreement' }
  return { value: 1 - ((n - 1) * Do) / De }
}
