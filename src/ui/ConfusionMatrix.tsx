import { useI18n } from '../i18n/I18nProvider'
import { fmt } from '../i18n/describe'
import type { AnalysisResult } from '../core/types'

interface Props {
  result: AnalysisResult
  cell: [string, string] | null
  /** called with the clicked (human, judge) labels, or null to clear */
  onSelect: (cell: [string, string] | null) => void
}

/** Confusion matrix (rows = human reference, columns = judge). Off-diagonal cells open the disagreement review. */
export function ConfusionMatrix({ result, cell, onSelect }: Props) {
  const { t } = useI18n()
  const c = result.confusion
  const maxOff = Math.max(1, ...c.matrix.flatMap((r, i) => r.filter((_, j) => j !== i)))
  return (
    <div data-testid="matrix">
      <p className="muted">
        {t('matrix.axis')} {t('matrix.hint')}
      </p>
      <table className="matrix">
        <thead>
          <tr>
            <th className="corner">
              {t('matrix.human')} ↓ / {t('matrix.judge')} →
            </th>
            {c.labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.matrix.map((row, i) => (
            <tr key={c.labels[i]}>
              <th>{c.labels[i]}</th>
              {row.map((v, j) => {
                const diag = i === j
                const selected = cell !== null && cell[0] === c.labels[i] && cell[1] === c.labels[j]
                const strength = diag ? 0 : v / maxOff
                return (
                  <td key={c.labels[j]}>
                    <button
                      type="button"
                      className={`cell${diag ? ' diag' : ' off'}${selected ? ' selected' : ''}`}
                      style={diag ? undefined : { background: `rgba(200, 60, 60, ${(0.08 + 0.5 * strength).toFixed(2)})` }}
                      data-testid={`cell-${c.labels[i]}-${c.labels[j]}`}
                      title={t('matrix.cellTitle', { human: c.labels[i], judge: c.labels[j], count: v })}
                      disabled={diag || v === 0}
                      aria-pressed={selected}
                      onClick={() => onSelect(selected ? null : [c.labels[i], c.labels[j]])}
                    >
                      {v}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{t('matrix.perLabel')}</h3>
      <table className="plain">
        <thead>
          <tr>
            <th>{t('map.label')}</th>
            <th>{t('matrix.precision')}</th>
            <th>{t('matrix.recall')}</th>
            <th>{t('matrix.support')}</th>
          </tr>
        </thead>
        <tbody>
          {result.perLabel.map((m) => (
            <tr key={m.label}>
              <td>{m.label}</td>
              <td>{fmt(m.precision)}</td>
              <td>{fmt(m.recall)}</td>
              <td>{m.support}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
