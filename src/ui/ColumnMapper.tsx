import { useI18n } from '../i18n/I18nProvider'
import type { AnalysisResult, Mapping, MappingIssue, ParseIssue, ParsedTable } from '../core/types'
import { IssueList, MappingIssueList } from './IssueList'
import { LabelTable } from './LabelTable'

interface Props {
  fileName: string
  table: ParsedTable
  mapping: Mapping
  onChange: (m: Mapping) => void
  issues: MappingIssue[]
  /** quick analysis of the current mapping (no bootstrap), shown as a one-line preview */
  preview: AnalysisResult | null
  parseErrors: ParseIssue[]
  onAnalyze: () => void
}

const toggle = (list: string[], item: string, on: boolean): string[] =>
  on ? (list.includes(item) ? list : [...list, item]) : list.filter((x) => x !== item)

/** Column roles, scale, reference, cleaning options and the label table. */
export function ColumnMapper({ fileName, table, mapping, onChange, issues, preview, parseErrors, onAnalyze }: Props) {
  const { t } = useI18n()
  const set = (patch: Partial<Mapping>) => onChange({ ...mapping, ...patch })

  const orderEditable = mapping.scale === 'ordinal' && preview !== null && !preview.numericLabels && preview.labels.length > 1
  const move = (i: number, d: -1 | 1) => {
    if (!preview) return
    const order = preview.labels.slice()
    const j = i + d
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    set({ order })
  }

  return (
    <section className="panel" data-testid="map-screen">
      <h2>{t('map.title')}</h2>
      <p className="muted">{t('map.fileInfo', { name: fileName, rows: table.rows.length, cols: table.fields.length })}</p>
      {parseErrors.length > 0 && (
        <div className="warn-box" data-testid="skipped-rows">
          <strong>{t('load.skipped')}</strong>
          <IssueList errors={parseErrors} />
        </div>
      )}

      <div className="grid2">
        <div>
          <h3>{t('map.columns')}</h3>
          <label className="field">
            <span>{t('map.id')}</span>
            <select value={mapping.idColumn ?? ''} onChange={(e) => set({ idColumn: e.target.value || null })}>
              <option value="">{t('map.none')}</option>
              {table.fields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t('map.human')}</legend>
            {table.fields.map((f) => (
              <label key={f} className="check">
                <input
                  type="checkbox"
                  data-testid={`human-${f}`}
                  checked={mapping.humanColumns.includes(f)}
                  onChange={(e) => set({ humanColumns: toggle(mapping.humanColumns, f, e.target.checked) })}
                />
                {f}
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>{t('map.judge')}</span>
            <select data-testid="judge-select" value={mapping.judgeColumn} onChange={(e) => set({ judgeColumn: e.target.value })}>
              <option value="">{t('map.choose')}</option>
              {table.fields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t('map.text')}</legend>
            {table.fields.map((f) => (
              <label key={f} className="check">
                <input
                  type="checkbox"
                  checked={mapping.textColumns.includes(f)}
                  onChange={(e) => set({ textColumns: toggle(mapping.textColumns, f, e.target.checked) })}
                />
                {f}
              </label>
            ))}
          </fieldset>
        </div>

        <div>
          <h3>{t('map.options')}</h3>
          <label className="field">
            <span>{t('map.scale')}</span>
            <select data-testid="scale-select" value={mapping.scale} onChange={(e) => set({ scale: e.target.value === 'ordinal' ? 'ordinal' : 'nominal' })}>
              <option value="nominal">{t('map.scaleNominal')}</option>
              <option value="ordinal">{t('map.scaleOrdinal')}</option>
            </select>
          </label>
          {mapping.humanColumns.length > 1 && (
            <label className="field">
              <span>{t('map.reference')}</span>
              <select
                value={mapping.reference.kind === 'column' ? mapping.reference.column : ''}
                onChange={(e) => set({ reference: e.target.value ? { kind: 'column', column: e.target.value } : { kind: 'majority' } })}
              >
                <option value="">{t('map.refMajority')}</option>
                {mapping.humanColumns.map((c) => (
                  <option key={c} value={c}>
                    {t('map.refColumn', { column: c })}
                  </option>
                ))}
              </select>
            </label>
          )}
          {preview && mapping.scale === 'nominal' && preview.labels.length === 2 && (
            <label className="field">
              <span>{t('map.positive')}</span>
              <select value={preview.positive ?? ''} onChange={(e) => set({ positive: e.target.value })}>
                {preview.labels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <h3>{t('map.normalize')}</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={mapping.normalize.trim}
              onChange={(e) => set({ normalize: { ...mapping.normalize, trim: e.target.checked } })}
            />
            {t('map.trim')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={mapping.normalize.caseInsensitive}
              onChange={(e) => set({ normalize: { ...mapping.normalize, caseInsensitive: e.target.checked } })}
            />
            {t('map.ignoreCase')}
          </label>
          <label className="field">
            <span>{t('map.missing')}</span>
            <input
              type="text"
              defaultValue={mapping.normalize.missingTokens.filter((x) => x !== '').join(', ')}
              onBlur={(e) =>
                set({
                  normalize: {
                    ...mapping.normalize,
                    missingTokens: ['', ...e.target.value.split(',').map((x) => x.trim()).filter((x) => x !== '')],
                  },
                })
              }
            />
          </label>
          {orderEditable && preview && (
            <div data-testid="order-editor">
              <h3>{t('map.order')}</h3>
              <p className="muted">{t('map.orderHint')}</p>
              <ol className="order-list">
                {preview.labels.map((l, i) => (
                  <li key={l}>
                    <code>{l}</code>
                    <button type="button" aria-label={t('map.up', { label: l })} disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button type="button" aria-label={t('map.down', { label: l })} disabled={i === preview.labels.length - 1} onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <LabelTable rows={table.rows} mapping={mapping} onChange={onChange} />

      {issues.length > 0 && (
        <div className="error-box" role="alert" data-testid="mapping-issues">
          <MappingIssueList issues={issues} />
        </div>
      )}
      <div className="row">
        {preview && issues.length === 0 && (
          <span className="muted" data-testid="map-preview">
            {t('map.preview', { n: preview.n, excluded: preview.exclusions.total })}
          </span>
        )}
        <button type="button" className="primary" data-testid="analyze" disabled={issues.length > 0} onClick={onAnalyze}>
          {t('map.analyze')}
        </button>
      </div>
    </section>
  )
}
