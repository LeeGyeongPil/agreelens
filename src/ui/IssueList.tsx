import { useI18n } from '../i18n/I18nProvider'
import { MESSAGES, type MessageKey } from '../i18n/translate'
import type { MappingIssue, ParseIssue } from '../core/types'

const MAX_SHOWN = 8

/** File problems (parse errors), translated. Long lists are cut so the page stays readable. */
export function IssueList({ errors }: { errors: ParseIssue[] }) {
  const { t } = useI18n()
  const describe = (e: ParseIssue): string => {
    const params = { row: e.row ?? 0, detail: e.detail ?? '' }
    const specific = e.reason ? `err.${e.code}.${e.reason}` : ''
    return t((specific in MESSAGES.en ? specific : `err.${e.code}`) as MessageKey, params)
  }
  return (
    <ul>
      {errors.slice(0, MAX_SHOWN).map((e, i) => (
        <li key={i}>{describe(e)}</li>
      ))}
      {errors.length > MAX_SHOWN && <li>... +{errors.length - MAX_SHOWN}</li>}
    </ul>
  )
}

/** Column-mapping problems, translated. */
export function MappingIssueList({ issues }: { issues: MappingIssue[] }) {
  const { t } = useI18n()
  return (
    <ul>
      {issues.map((m, i) => (
        <li key={i}>{t(`issue.${m.code}`, { column: m.column ?? '' })}</li>
      ))}
    </ul>
  )
}
