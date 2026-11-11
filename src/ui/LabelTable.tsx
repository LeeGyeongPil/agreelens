import { useMemo } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { summarizeLabels } from '../core/normalize'
import type { Mapping } from '../core/types'

interface Props {
  rows: readonly Record<string, string>[]
  mapping: Mapping
  onChange: (m: Mapping) => void
}

/** Label table: which spellings were folded together, merge two labels, leave a label out. */
export function LabelTable({ rows, mapping, onChange }: Props) {
  const { t } = useI18n()
  const columns = useMemo(
    () => [...mapping.humanColumns, ...(mapping.judgeColumn ? [mapping.judgeColumn] : [])],
    [mapping.humanColumns, mapping.judgeColumn],
  )
  const summary = useMemo(() => summarizeLabels(rows, columns, mapping.normalize), [rows, columns, mapping.normalize])
  if (columns.length === 0) return null
  const labels = summary.labels.map((l) => l.label)

  const setMerge = (label: string, target: string) => {
    const merge = { ...mapping.merge }
    if (target === '') delete merge[label]
    else merge[label] = target
    onChange({ ...mapping, merge })
  }
  const setExcluded = (label: string, on: boolean) => {
    const set = new Set(mapping.excludedLabels)
    if (on) set.add(label)
    else set.delete(label)
    onChange({ ...mapping, excludedLabels: Array.from(set) })
  }

  return (
    <div>
      <h3>{t('map.labels')}</h3>
      {summary.numeric && <p className="muted">{t('map.numeric')}</p>}
      <table className="label-table" data-testid="label-table">
        <thead>
          <tr>
            <th>{t('map.label')}</th>
            <th>{t('map.spellings')}</th>
            <th>{t('map.count')}</th>
            <th>{t('map.mergeInto')}</th>
            <th>{t('map.exclude')}</th>
          </tr>
        </thead>
        <tbody>
          {summary.labels.map((l) => (
            <tr key={l.label}>
              <td>
                <code>{l.label}</code>
              </td>
              <td>{l.variants.map((v) => JSON.stringify(v)).join(', ')}</td>
              <td>{l.count}</td>
              <td>
                <select aria-label={`${t('map.mergeInto')} ${l.label}`} value={mapping.merge[l.label] ?? ''} onChange={(e) => setMerge(l.label, e.target.value)}>
                  <option value="">{t('map.keep')}</option>
                  {labels
                    .filter((x) => x !== l.label)
                    .map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${t('map.exclude')} ${l.label}`}
                  checked={mapping.excludedLabels.includes(l.label)}
                  onChange={(e) => setExcluded(l.label, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
