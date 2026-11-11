import { useI18n } from '../i18n/I18nProvider'
import { isLang } from '../i18n/translate'

/** English / 한국어 menu. The choice is saved by the provider. */
export function LangMenu() {
  const { lang, setLang, t } = useI18n()
  return (
    <label className="lang-menu">
      <span>{t('lang.label')}</span>
      <select
        data-testid="lang-menu"
        value={lang}
        onChange={(e) => {
          if (isLang(e.target.value)) setLang(e.target.value)
        }}
      >
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </select>
    </label>
  )
}
