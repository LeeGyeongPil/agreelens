import { DEFAULT_SEED } from './analyze'
import { directionText, fmt, fmtStat, naMessage, warningText } from '../i18n/describe'
import { translate, type Lang, type Messages, type Params, type MessageKey } from '../i18n/translate'
import type { AnalysisResult, BootstrapCI, Mapping, Stat } from './types'

export interface ReportMeta {
  toolVersion: string
  fileName?: string
  /** ISO timestamp; passed in so reports are reproducible in tests */
  generatedAt: string
}

const statJson = (s: Stat | null, ci?: BootstrapCI | null) =>
  s === null ? null : { value: s.value, ...(s.reason ? { reason: s.reason } : {}), ...(ci ? { ci } : {}) }

/** Machine-readable report: numbers, the settings that produced them, and the warnings. */
export function buildReport(result: AnalysisResult, mapping: Mapping, meta: ReportMeta) {
  return {
    tool: { name: 'agreelens', version: meta.toolVersion },
    generatedAt: meta.generatedAt,
    file: meta.fileName ?? null,
    settings: {
      scale: result.scale,
      order: result.labels,
      reference: result.referenceDescription,
      positive: result.positive,
      humanColumns: mapping.humanColumns,
      judgeColumn: mapping.judgeColumn,
      missing: { tokens: mapping.normalize.missingTokens, trim: mapping.normalize.trim, caseInsensitive: mapping.normalize.caseInsensitive },
      merge: mapping.merge,
      excludedLabels: mapping.excludedLabels,
      excludedRows: result.exclusions,
      bootstrap: { iters: result.kappaCI?.iters ?? 0, seed: DEFAULT_SEED },
    },
    stats: {
      n: result.n,
      totalRows: result.totalRows,
      labels: result.labels,
      agreement: statJson(result.agreement),
      kappa: statJson(result.kappa, result.kappaCI),
      kappaLinear: statJson(result.kappaLinear),
      kappaQuadratic: statJson(result.kappaQuadratic, result.kappaQuadraticCI),
      mcc: statJson(result.mcc),
      alpha: result.alphas.map((a) => ({ level: a.level, humans: statJson(a.humans), withJudge: statJson(a.withJudge) })),
      perRater: result.perRater.map((r) => ({ column: r.column, n: r.n, kappa: statJson(r.kappa) })),
      confusion: result.confusion,
      perLabel: result.perLabel,
      direction: result.direction,
    },
    warnings: result.warnings,
  }
}

export function toReportJson(result: AnalysisResult, mapping: Mapping, meta: ReportMeta): string {
  return JSON.stringify(buildReport(result, mapping, meta), null, 2) + '\n'
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const CSS = `body{font:15px/1.5 system-ui,-apple-system,"Segoe UI","Noto Sans KR",sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1f2430}
h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.8rem}table{border-collapse:collapse;margin:.5rem 0}
th,td{border:1px solid #cfd4dc;padding:.3rem .7rem;text-align:right}th:first-child,td:first-child{text-align:left}
.warn{background:#fff6d6;border:1px solid #e2c34a;padding:.4rem .7rem;margin:.4rem 0;border-radius:4px}
.info{background:#eef3fb;border:1px solid #b8c8e4;padding:.4rem .7rem;margin:.4rem 0;border-radius:4px}
.muted{color:#5b6475;font-size:.9rem}`

/** Self-contained HTML report in the given language (no external resources). */
export function toReportHtml(result: AnalysisResult, mapping: Mapping, messages: Messages, lang: Lang, meta: ReportMeta): string {
  const t = (key: MessageKey, params?: Params) => translate(messages, key, params)
  const na = (s: Stat | null) => (s && s.value === null ? `NA (${esc(naMessage(t, s.reason))})` : esc(fmtStat(s)))
  const ci = (c: BootstrapCI | null) => (c && c.lo !== null && c.hi !== null ? ` [${fmt(c.lo, 2)}, ${fmt(c.hi, 2)}]` : '')
  const rows: string[] = []
  const add = (label: string, value: string) => rows.push(`<tr><td>${esc(label)}</td><td>${value}</td></tr>`)
  add(t('card.n'), `${result.n} / ${result.totalRows}`)
  add(t('card.agreement'), na(result.agreement))
  add(t('card.kappa'), `${na(result.kappa)}${esc(ci(result.kappaCI))}`)
  if (result.kappaLinear) add(t('card.kappaLinear'), na(result.kappaLinear))
  if (result.kappaQuadratic) add(t('card.kappaQuadratic'), `${na(result.kappaQuadratic)}${esc(ci(result.kappaQuadraticCI))}`)
  if (result.mcc) add(t('card.mcc'), na(result.mcc))
  for (const a of result.alphas) {
    add(`${t('card.alphaHumans')} (${esc(t('card.alphaLevel', { level: t(`level.${a.level}` as MessageKey) }))})`, na(a.humans))
    add(`${t('card.alphaJudge')} (${esc(t('card.alphaLevel', { level: t(`level.${a.level}` as MessageKey) }))})`, na(a.withJudge))
  }
  const warnings = result.warnings.length
    ? result.warnings.map((w) => `<div class="${w.severity === 'warn' ? 'warn' : 'info'}">${esc(warningText(t, w))}</div>`).join('\n')
    : `<p class="muted">${esc(t('card.noWarnings'))}</p>`
  const c = result.confusion
  const matrix =
    `<table><tr><th>${esc(t('matrix.human'))} \\ ${esc(t('matrix.judge'))}</th>${c.labels.map((l) => `<th>${esc(l)}</th>`).join('')}</tr>` +
    c.matrix.map((r, i) => `<tr><td>${esc(c.labels[i])}</td>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('') +
    '</table>'
  const perLabel =
    `<table><tr><th>${esc(t('map.label'))}</th><th>${esc(t('matrix.precision'))}</th><th>${esc(t('matrix.recall'))}</th><th>${esc(t('matrix.support'))}</th></tr>` +
    result.perLabel
      .map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(fmt(m.precision))}</td><td>${esc(fmt(m.recall))}</td><td>${m.support}</td></tr>`)
      .join('') +
    '</table>'
  const settings = [
    t('report.scale', { scale: t(`scale.${result.scale}` as MessageKey) }),
    t('report.order', { order: result.labels.join(', ') }),
    t('report.columns', { humans: mapping.humanColumns.join(', '), judge: mapping.judgeColumn }),
    t('card.reference', {
      description: result.referenceDescription.kind === 'column' ? t('card.refColumn', { column: result.referenceDescription.column ?? '' }) : t('card.refMajority'),
    }),
    t('report.missing', { tokens: mapping.normalize.missingTokens.map((x) => (x === '' ? '(blank)' : x)).join(', ') }),
    t('report.bootstrap', { iters: result.kappaCI?.iters ?? 0, seed: DEFAULT_SEED }),
  ]
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t('report.title'))}</title>
<style>${CSS}</style>
</head>
<body>
<h1>${esc(t('report.title'))}</h1>
<p class="muted">${esc(t('report.generated', { date: meta.generatedAt, version: meta.toolVersion }))}${meta.fileName ? '<br>' + esc(t('report.file', { name: meta.fileName })) : ''}</p>
<h2>${esc(t('report.stats'))}</h2>
<table>
${rows.join('\n')}
</table>
${result.direction ? `<p>${esc(directionText(t, result.direction))}</p>` : ''}
<h2>${esc(t('card.warnings'))}</h2>
${warnings}
<h2>${esc(t('matrix.title'))}</h2>
<p class="muted">${esc(t('matrix.axis'))}</p>
${matrix}
<h2>${esc(t('matrix.perLabel'))}</h2>
${perLabel}
<h2>${esc(t('report.settings'))}</h2>
<ul>
${settings.map((s) => `<li>${esc(s)}</li>`).join('\n')}
</ul>
</body>
</html>
`
}
