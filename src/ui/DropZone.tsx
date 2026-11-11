import { useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { ParseIssue } from '../core/types'
import type { SampleId } from '../samples'
import { IssueList } from './IssueList'

interface Props {
  onFile: (file: File) => void
  onSample: (id: SampleId) => void
  busy: boolean
  errors: ParseIssue[]
}

/** Start screen: drop or choose a file, or load one of the practice samples. */
export function DropZone({ onFile, onSample, busy, errors }: Props) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <section className="panel" data-testid="load-screen">
      <h2>{t('load.title')}</h2>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
      >
        <p className="drop-text">{busy ? t('load.reading') : t('load.drop')}</p>
        <p className="muted">{t('load.or')}</p>
        <button type="button" onClick={() => input.current?.click()}>
          {t('load.choose')}
        </button>
        <input
          ref={input}
          data-testid="file-input"
          type="file"
          accept=".csv,.tsv,.jsonl,.ndjson,.txt"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>
      <p className="muted">{t('load.expect')}</p>
      {errors.length > 0 && (
        <div className="error-box" role="alert" data-testid="load-errors">
          <strong>{t('load.errors')}</strong>
          <IssueList errors={errors} />
        </div>
      )}
      <h3>
        {t('load.samples')} <span className="badge">{t('mock.badge')}</span>
      </h3>
      <div className="row">
        <button type="button" data-testid="sample-binary" onClick={() => onSample('binary')}>
          {t('load.sampleBinary')}
        </button>
        <button type="button" data-testid="sample-ordinal" onClick={() => onSample('ordinal')}>
          {t('load.sampleOrdinal')}
        </button>
      </div>
      <p className="muted privacy">{t('privacy.note')}</p>
    </section>
  )
}
