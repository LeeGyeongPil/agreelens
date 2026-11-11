import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { ciText, directionText, fmt, naMessage, warningText } from '../i18n/describe'
import type { MessageKey } from '../i18n/translate'
import type { AnalysisResult, BootstrapCI, Stat } from '../core/types'

function Card({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <div className="card" data-testid={testId}>
      <div className="card-title">{title}</div>
      {children}
    </div>
  )
}

/** A number, or "NA" with the reason underneath. NA is never shown as 0. */
function Value({ stat, ci, testId, sub }: { stat: Stat | null; ci?: BootstrapCI | null; testId?: string; sub?: string }) {
  const { t } = useI18n()
  const na = !stat || stat.value === null
  const ciLine = ciText(t, ci ?? null)
  return (
    <>
      <div className={`card-value${na ? ' na' : ''}`} data-testid={testId}>
        {na ? t('card.na') : fmt(stat.value)}
      </div>
      {na && <div className="card-sub">{naMessage(t, stat?.reason)}</div>}
      {!na && ciLine && <div className="card-sub">{ciLine}</div>}
      {!na && ci && ci.dropped > 0 && <div className="card-sub">{t('card.ciDropped', { count: ci.dropped })}</div>}
      {sub && <div className="card-sub">{sub}</div>}
    </>
  )
}

export function SummaryCards({ result }: { result: AnalysisResult }) {
  const { t } = useI18n()
  const ref = result.referenceDescription
  return (
    <div data-testid="summary">
      <div className="cards">
        <Card title={t('card.n')} testId="card-n">
          <div className="card-value" data-testid="n-value">
            {result.n}
          </div>
          <div className="card-sub">{t('card.nSub', { total: result.totalRows, excluded: result.exclusions.total })}</div>
        </Card>
        <Card title={t('card.agreement')}>
          <Value stat={result.agreement} testId="agreement-value" />
        </Card>
        <Card title={t('card.kappa')}>
          <Value stat={result.kappa} ci={result.kappaCI} testId="kappa-value" sub={result.kappaLinear ? t('card.kappaSub') : undefined} />
        </Card>
        {result.kappaLinear && (
          <Card title={t('card.kappaLinear')}>
            <Value stat={result.kappaLinear} testId="kappa-linear-value" />
          </Card>
        )}
        {result.kappaQuadratic && (
          <Card title={t('card.kappaQuadratic')}>
            <Value stat={result.kappaQuadratic} ci={result.kappaQuadraticCI} testId="kappa-quadratic-value" />
          </Card>
        )}
        {result.mcc && (
          <Card title={t('card.mcc')}>
            <Value stat={result.mcc} testId="mcc-value" />
          </Card>
        )}
        {result.alphas.map((a) => (
          <Card key={`h-${a.level}`} title={`${t('card.alphaHumans')}`}>
            <Value stat={a.humans} testId={`alpha-humans-${a.level}`} sub={t('card.alphaLevel', { level: t(`level.${a.level}` as MessageKey) })} />
          </Card>
        ))}
        {result.alphas.map((a) => (
          <Card key={`j-${a.level}`} title={`${t('card.alphaJudge')}`}>
            <Value stat={a.withJudge} testId={`alpha-judge-${a.level}`} sub={t('card.alphaLevel', { level: t(`level.${a.level}` as MessageKey) })} />
          </Card>
        ))}
      </div>
      <p className="muted">
        {t('card.reference', { description: ref.kind === 'column' ? t('card.refColumn', { column: ref.column ?? '' }) : t('card.refMajority') })}
      </p>
      {result.alphas.length > 0 && <p className="muted">{t('card.baseline')}</p>}

      <h3>{t('card.warnings')}</h3>
      <div data-testid="warnings">
        {result.warnings.length === 0 && <p className="muted">{t('card.noWarnings')}</p>}
        {result.warnings.map((w, i) => (
          <div key={i} className={w.severity === 'warn' ? 'warn-box' : 'info-box'} data-testid={`warning-${w.code}`}>
            {warningText(t, w)}
          </div>
        ))}
      </div>

      {result.direction && (
        <>
          <h3>{t('card.direction')}</h3>
          <p data-testid="direction">{directionText(t, result.direction)}</p>
        </>
      )}

      {result.perRater.length > 0 && (
        <>
          <h3>{t('card.perRater')}</h3>
          <table className="plain">
            <thead>
              <tr>
                <th>{t('card.rater')}</th>
                <th>{t('card.raterN')}</th>
                <th>{t('card.kappa')}</th>
              </tr>
            </thead>
            <tbody>
              {result.perRater.map((r) => (
                <tr key={r.column}>
                  <td>{r.column}</td>
                  <td>{r.n}</td>
                  <td>{r.kappa.value === null ? t('card.na') : fmt(r.kappa.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
