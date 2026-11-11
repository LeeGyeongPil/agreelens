import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANG_KEY, readStorage, writeStorage } from '../ui/storage'
import { isLang, makeTranslate, pickLang, type Lang, type Translate } from './translate'

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
}

const Ctx = createContext<I18n | null>(null)

/** Language for the first render: ?lang= > saved choice > (first visit only) browser language. */
function initialLang(): Lang {
  const urlLang = new URLSearchParams(window.location.search).get('lang')
  const saved = readStorage(LANG_KEY)
  const lang = pickLang(urlLang, saved, navigator.languages ?? [navigator.language])
  // An explicit ?lang= counts as the user's choice; the first-visit guess is remembered too, so it is only made once.
  if (isLang(urlLang) || !isLang(saved)) writeStorage(LANG_KEY, lang)
  return lang
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    writeStorage(LANG_KEY, next)
    setLangState(next)
  }, [])

  const value = useMemo<I18n>(() => ({ lang, setLang, t: makeTranslate(lang) }), [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>')
  return v
}
