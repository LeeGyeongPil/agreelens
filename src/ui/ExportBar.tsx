import { useI18n } from '../i18n/I18nProvider'
import { buildNotesCsv } from '../core/csv'
import { toReportHtml, toReportJson } from '../core/report'
import { MESSAGES } from '../i18n/translate'
import type { AnalysisResult, Mapping } from '../core/types'
import { downloadText } from './download'

interface Props {
  result: AnalysisResult
  mapping: Mapping
  fileName: string
  rows: readonly Record<string, string>[]
  notes: Record<string, string>
  onClearNotes: () => void
  /** which buttons to show: reports in every view, notes only while reviewing */
  showNotes: boolean
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'agreelens'

/** Report (HTML / JSON) and notes CSV downloads. All of them are built in the browser. */
export function ExportBar({ result, mapping, fileName, rows, notes, onClearNotes, showNotes }: Props) {
  const { t, lang } = useI18n()
  const meta = () => ({ toolVersion: __APP_VERSION__, fileName, generatedAt: new Date().toISOString() })
  return (
    <div className="row export-bar">
      <button
        type="button"
        data-testid="export-html"
        onClick={() => downloadText(`${baseName(fileName)}.agreelens.${lang}.html`, toReportHtml(result, mapping, MESSAGES[lang], lang, meta()), 'text/html')}
      >
        {t('export.reportHtml')}
      </button>
      <button
        type="button"
        data-testid="export-json"
        onClick={() => downloadText(`${baseName(fileName)}.agreelens.json`, toReportJson(result, mapping, meta()), 'application/json')}
      >
        {t('export.reportJson')}
      </button>
      {showNotes && (
        <>
          <button
            type="button"
            data-testid="export-csv"
            onClick={() => downloadText(`${baseName(fileName)}.notes.csv`, buildNotesCsv(result, rows, mapping, notes), 'text/csv')}
          >
            {t('export.notesCsv')}
          </button>
          <button type="button" data-testid="clear-notes" onClick={onClearNotes}>
            {t('export.clearNotes')}
          </button>
        </>
      )}
    </div>
  )
}
