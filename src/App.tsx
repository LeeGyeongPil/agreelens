import { useEffect, useMemo, useState } from 'react'
import { analyze } from './core/analyze'
import { guessMapping, validateMapping } from './core/mapping'
import { parseTable } from './core/parse'
import type { Mapping, ParseIssue, ParsedTable } from './core/types'
import { useI18n } from './i18n/I18nProvider'
import { makeTranslate } from './i18n/translate'
import { SAMPLES, sampleMapping, type SampleId } from './samples'
import { ColumnMapper } from './ui/ColumnMapper'
import { ConfusionMatrix } from './ui/ConfusionMatrix'
import { DisagreementTable } from './ui/DisagreementTable'
import { DropZone } from './ui/DropZone'
import { ExportBar } from './ui/ExportBar'
import { LangMenu } from './ui/LangMenu'
import { SummaryCards } from './ui/SummaryCards'
import { readFileText } from './ui/download'
import { fingerprint, loadNotes, saveNotes } from './ui/storage'
import { readUrlState, type View } from './ui/urlState'

type Stage = 'load' | 'map' | 'result'

interface Source {
  fileName: string
  table: ParsedTable
  sampleId: SampleId | null
  /** key for the notes saved in this browser */
  fp: string
}

interface Loaded {
  source: Source
  mapping: Mapping
  notes: Record<string, string>
  exampleNoteRow: number | null
}

/** Load a bundled practice sample. The binary sample also gets one pre-filled example note. */
function loadSample(id: SampleId, noteText: string): Loaded {
  const s = SAMPLES[id]
  const table = parseTable(s.text, s.kind, s.fileName)
  const mapping = sampleMapping(id, table.fields)
  const source: Source = { fileName: s.fileName, table, sampleId: id, fp: fingerprint(s.fileName, table.rows.length, table.fields) }
  let notes = loadNotes(source.fp)
  let exampleNoteRow: number | null = null
  if (id === 'binary' && Object.keys(notes).length === 0) {
    const r = analyze(table.rows, mapping, { bootstrapIters: 0 }).rows.find((x) => x.reference === 'fail' && x.judge === 'pass')
    if (r) {
      exampleNoteRow = r.index
      notes = { [String(r.index)]: noteText }
    }
  }
  return { source, mapping, notes, exampleNoteRow }
}

export function App() {
  const { t, lang } = useI18n()
  // Address options (?sample, ?view, ?cell) are read once, so a screenshot URL fully decides the first screen.
  const [url] = useState(() => readUrlState(window.location.search))
  const [initial] = useState<Loaded | null>(() => (url.sample ? loadSample(url.sample, makeTranslate(lang)('sample.note')) : null))

  const [source, setSource] = useState<Source | null>(initial?.source ?? null)
  const [mapping, setMapping] = useState<Mapping | null>(initial?.mapping ?? null)
  const [notes, setNotes] = useState<Record<string, string>>(initial?.notes ?? {})
  const [exampleNoteRow, setExampleNoteRow] = useState<number | null>(initial?.exampleNoteRow ?? null)
  const [stage, setStage] = useState<Stage>(initial ? 'result' : 'load')
  const [view, setView] = useState<View>(url.view)
  const [cell, setCell] = useState<[string, string] | null>(url.cell)
  const [loadErrors, setLoadErrors] = useState<ParseIssue[]>([])
  const [busy, setBusy] = useState(false)

  const issues = useMemo(() => (source && mapping ? validateMapping(source.table.fields, mapping) : []), [source, mapping])
  const full = stage === 'result'
  const analysis = useMemo(
    () => (source && mapping && issues.length === 0 && stage !== 'load' ? analyze(source.table.rows, mapping, full ? {} : { bootstrapIters: 0 }) : null),
    [source, mapping, issues, stage, full],
  )

  // Screenshot tools wait for this flag: set once the current screen has been drawn.
  useEffect(() => {
    document.body.dataset.ready = '1'
  }, [stage, analysis, view])

  const startLoaded = (l: Loaded, nextStage: Stage) => {
    setSource(l.source)
    setMapping(l.mapping)
    setNotes(l.notes)
    setExampleNoteRow(l.exampleNoteRow)
    setCell(null)
    setView('summary')
    setLoadErrors([])
    setStage(nextStage)
  }

  const onSample = (id: SampleId) => startLoaded(loadSample(id, t('sample.note')), 'result')

  const onFile = async (file: File) => {
    setBusy(true)
    setLoadErrors([])
    let text: string
    try {
      text = await readFileText(file)
    } catch {
      setBusy(false)
      setLoadErrors([{ code: 'read_failed' }])
      return
    }
    setBusy(false)
    const table = parseTable(text, undefined, file.name)
    if (table.rows.length === 0 || table.fields.length === 0) {
      setLoadErrors(table.errors)
      return
    }
    const fp = fingerprint(file.name, table.rows.length, table.fields)
    startLoaded({ source: { fileName: file.name, table, sampleId: null, fp }, mapping: guessMapping(table.fields), notes: loadNotes(fp), exampleNoteRow: null }, 'map')
  }

  const onNote = (rowIndex: number, text: string) => {
    if (!source) return
    const next = { ...notes, [String(rowIndex)]: text }
    setNotes(next)
    if (rowIndex === exampleNoteRow) setExampleNoteRow(null)
    saveNotes(source.fp, next)
  }

  const onClearNotes = () => {
    if (!source) return
    setNotes({})
    setExampleNoteRow(null)
    saveNotes(source.fp, {})
  }

  const onSelectCell = (c: [string, string] | null) => {
    setCell(c)
    if (c) setView('review')
  }

  // A ?cell= that does not exist in this data is ignored instead of showing an empty table.
  const activeCell = cell && analysis && analysis.labels.includes(cell[0]) && analysis.labels.includes(cell[1]) ? cell : null

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>{t('app.title')}</h1>
          <p className="muted">{t('app.tagline')}</p>
        </div>
        <LangMenu />
      </header>

      {stage === 'load' && <DropZone onFile={onFile} onSample={onSample} busy={busy} errors={loadErrors} />}

      {stage === 'map' && source && mapping && (
        <ColumnMapper
          fileName={source.fileName}
          table={source.table}
          mapping={mapping}
          onChange={setMapping}
          issues={issues}
          preview={analysis}
          parseErrors={source.table.errors}
          onAnalyze={() => setStage('result')}
        />
      )}

      {stage === 'result' && source && mapping && analysis && (
        <main>
          <div className="file-bar">
            <strong>{source.fileName}</strong>
            {source.sampleId && <span className="badge">{t('mock.badge')}</span>}
            <button type="button" data-testid="edit-mapping" onClick={() => setStage('map')}>
              {t('result.editMapping')}
            </button>
            <button type="button" onClick={() => setStage('load')}>
              {t('result.newFile')}
            </button>
          </div>
          <ExportBar
            result={analysis}
            mapping={mapping}
            fileName={source.fileName}
            rows={source.table.rows}
            notes={notes}
            onClearNotes={onClearNotes}
            showNotes={view === 'review'}
          />
          <div className="tabs" role="tablist" aria-label={t('result.views')}>
            {(['summary', 'matrix', 'review'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'tab active' : 'tab'} data-testid={`tab-${v}`} onClick={() => setView(v)}>
                {t(`tab.${v}`)}
              </button>
            ))}
          </div>
          {view === 'summary' && <SummaryCards result={analysis} />}
          {view === 'matrix' && <ConfusionMatrix result={analysis} cell={activeCell} onSelect={onSelectCell} />}
          {view === 'review' && (
            <DisagreementTable
              result={analysis}
              rows={source.table.rows}
              mapping={mapping}
              cell={activeCell}
              notes={notes}
              onNote={onNote}
              exampleNoteRow={exampleNoteRow}
              onClearFilter={() => setCell(null)}
            />
          )}
        </main>
      )}

      {stage === 'result' && !analysis && source && (
        <div className="error-box">
          <button type="button" onClick={() => setStage('map')}>
            {t('result.editMapping')}
          </button>
        </div>
      )}
    </div>
  )
}
