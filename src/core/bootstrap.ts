import type { BootstrapCI } from './types'

/** Small seeded PRNG so a report can be reproduced exactly. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Linear-interpolation percentile (numpy's default). `sorted` must be ascending and non-empty. */
function percentile(sorted: number[], p: number): number {
  const h = (sorted.length - 1) * p
  const l = Math.floor(h)
  return sorted[l] + (h - l) * (sorted[Math.min(l + 1, sorted.length - 1)] - sorted[l])
}

/**
 * Percentile bootstrap 95% CI. `stat` receives the resampled row indices and returns the statistic,
 * or null/NaN when it is undefined for that resample (those are counted in `dropped`, not used).
 */
export function bootstrapCI(n: number, stat: (indices: number[]) => number | null, iters = 1000, seed = 1): BootstrapCI {
  const rnd = mulberry32(seed)
  const out: number[] = []
  const idx = new Array<number>(n)
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rnd() * n)
    const v = stat(idx)
    if (v !== null && Number.isFinite(v)) out.push(v)
  }
  if (out.length === 0) return { lo: null, hi: null, used: 0, dropped: iters, iters }
  out.sort((x, y) => x - y)
  return { lo: percentile(out, 0.025), hi: percentile(out, 0.975), used: out.length, dropped: iters - out.length, iters }
}

/** Resample count that keeps the main thread responsive: 1000 up to 2000 rows, fewer for bigger files. */
export function defaultIters(n: number): number {
  if (n <= 0) return 0
  return Math.max(100, Math.min(1000, Math.floor(2_000_000 / n)))
}
