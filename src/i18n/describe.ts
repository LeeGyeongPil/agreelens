import type { AgreementWarning, BootstrapCI, Direction, NaReason, Stat } from '../core/types'
import type { Translate } from './translate'

/** Fixed-digit number, "NA" for undefined. */
export function fmt(v: number | null, digits = 3): string {
  return v === null || !Number.isFinite(v) ? 'NA' : v.toFixed(digits)
}

export function fmtStat(s: Stat | null | undefined, digits = 3): string {
  return s ? fmt(s.value, digits) : 'NA'
}

export function naMessage(t: Translate, reason: NaReason | undefined): string {
  return t(`na.${reason ?? 'undefined'}`)
}

export function ciText(t: Translate, ci: BootstrapCI | null): string | null {
  if (!ci || ci.lo === null || ci.hi === null) return null
  return t('card.ci', { lo: fmt(ci.lo, 2), hi: fmt(ci.hi, 2) })
}

export function warningText(t: Translate, w: AgreementWarning): string {
  const p = w.params
  switch (w.code) {
    case 'prevalence':
      return t(p.source === 'judge' ? 'warn.prevalence_judge' : 'warn.prevalence_human', {
        share: Math.round(Number(p.share) * 100),
        label: String(p.label),
      })
    case 'judge_single_label':
      return t('warn.judge_single_label', { label: String(p.label) })
    case 'no_rows':
      return t('warn.no_rows')
    case 'small_sample':
      return t('warn.small_sample', { n: Number(p.n), min: Number(p.min) })
    case 'excluded_rows':
      return t('warn.excluded_rows', {
        count: Number(p.count),
        judgeMissing: Number(p.judgeMissing),
        humanMissing: Number(p.humanMissing),
        tie: Number(p.tie),
      })
  }
}

export function directionText(t: Translate, d: Direction): string {
  if (d.kind === 'binary') return t('dir.binary', { lenient: d.lenient, strict: d.strict, positive: d.positive })
  const mean = d.meanDiff === null ? 'NA' : (d.meanDiff >= 0 ? '+' : '') + d.meanDiff.toFixed(2)
  return t('dir.ordinal', { mean, above: d.above, below: d.below, equal: d.equal })
}
