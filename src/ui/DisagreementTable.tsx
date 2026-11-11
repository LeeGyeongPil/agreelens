import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { AnalysisResult, Mapping } from '../core/types'

interface Props {
  result: AnalysisResult
  /** original table rows (PreparedRow.index points into this) */
  rows: readonly Record<string, string>[]
  mapping: Mapping
  cell: [string, string] | null
  notes: Record<string, string>
  onNote: (rowIndex: number, text: string) => void
  /** row index whose note is the pre-filled example note (practice samples only) */
  exampleNoteRow: number | null
  onClearFilter: () => void
}

const PAGE = 100
const PREVIEW_CHARS = 90

/** Rows where the judge differs from the human reference, with expandable text and a note field. */
export function DisagreementTable({ result, rows, mapping, cell, notes, onNote, exampleNoteRow, onClearFilter }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [limit, setLimit] = useState(PAGE)

  const all = useMemo(() => result.rows.filter((r) => r.reference !== r.judge), [result.rows])
  const shown = useMemo(() => (cell ? all.filter((r) => r.reference === cell[0] && r.judge === cell[1]) : all), [all, cell])

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div data-testid="review">
      <div className="row">
        <p data-testid="review-filter">
          {cell ? t('review.filter', { human: cell[0], judge: cell[1], count: shown.length }) : t('review.all', { count: shown.length })}
        </p>
        {cell && (
          <button type="button" onClick={onClearFilter}>
            {t('review.clearFilter')}
          </button>
        )}
      </div>
      <p className="muted">{t('review.notesSaved')}</p>
      {shown.length === 0 ? (
        <p className="muted">{t('review.empty')}</p>
      ) : (
        <table className="review-table">
          <thead>
            <tr>
              <th>{t('review.id')}</th>
              <th>{t('review.human')}</th>
              <th>{t('review.judge')}</th>
              <th>{t('review.text')}</th>
              <th>{t('review.note')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => {
              const expanded = open.has(r.index)
              const row = rows[r.index] ?? {}
              const first = mapping.textColumns.length > 0 ? row[mapping.textColumns[0]] ?? '' : ''
              const note = notes[String(r.index)] ?? ''
              return (
                <tr key={r.index} data-testid="disagreement-row">
                  <td>{r.id}</td>
                  <td>{r.reference}</td>
                  <td>{r.judge}</td>
                  <td className="text-cell">
                    {expanded ? (
                      <dl>
                        {mapping.textColumns.map((c) => (
                          <div key={c}>
                            <dt>{c}</dt>
                            <dd>{row[c] ?? ''}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <span>{first.length > PREVIEW_CHARS ? first.slice(0, PREVIEW_CHARS) + '...' : first}</span>
                    )}
                    {mapping.textColumns.length > 0 && (
                      <button type="button" className="link" data-testid={`expand-${r.index}`} aria-expanded={expanded} onClick={() => toggle(r.index)}>
                        {expanded ? t('review.collapse') : t('review.expand')}
                      </button>
                    )}
                  </td>
                  <td>
                    <textarea
                      data-testid={`note-${r.index}`}
                      aria-label={`${t('review.note')} ${r.id}`}
                      rows={2}
                      value={note}
                      placeholder={t('review.notePlaceholder')}
                      onChange={(e) => onNote(r.index, e.target.value)}
                    />
                    {exampleNoteRow === r.index && note !== '' && <span className="badge">{t('review.exampleNote')}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {shown.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)}>
          {t('review.more')}
        </button>
      )}
    </div>
  )
}
