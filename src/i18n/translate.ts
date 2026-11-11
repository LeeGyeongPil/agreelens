import { en, type MessageKey } from './messages.en'
import { ko } from './messages.ko'

export type Lang = 'en' | 'ko'
export type Params = Record<string, string | number>
export type Translate = (key: MessageKey, params?: Params) => string
export type Messages = Record<MessageKey, string>
export type { MessageKey }

export const LANGS: readonly Lang[] = ['en', 'ko']
export const MESSAGES: Record<Lang, Messages> = { en, ko }

/** Fill {name} placeholders. Unknown placeholders stay as written. */
export function translate(messages: Messages, key: MessageKey, params?: Params): string {
  const text = messages[key] ?? en[key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

export function makeTranslate(lang: Lang): Translate {
  const messages = MESSAGES[lang]
  return (key, params) => translate(messages, key, params)
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ko'
}

/**
 * Which language to show.
 *  1. `?lang=` in the address (an explicit choice, ignored when invalid)
 *  2. the language saved from an earlier visit
 *  3. first visit only: the browser's first language - Korean for ko*, otherwise English
 */
export function pickLang(urlLang: string | null | undefined, saved: string | null | undefined, browserLangs: readonly string[]): Lang {
  if (isLang(urlLang)) return urlLang
  if (isLang(saved)) return saved
  const first = browserLangs[0]
  return typeof first === 'string' && first.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}
