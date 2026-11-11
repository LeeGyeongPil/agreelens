// @vitest-environment jsdom
// AC-6: English / Korean UI, the language menu, saving and first-visit detection.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/App'
import { I18nProvider } from '../../src/i18n/I18nProvider'
import { en } from '../../src/i18n/messages.en'
import { ko } from '../../src/i18n/messages.ko'
import { pickLang } from '../../src/i18n/translate'

function setBrowserLanguages(langs: string[]) {
  Object.defineProperty(window.navigator, 'languages', { value: langs, configurable: true })
}

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
  document.documentElement.lang = ''
  setBrowserLanguages(['en-US'])
})
afterEach(cleanup)

describe('pickLang rule: ?lang > saved > (first visit) browser > en', () => {
  it('explicit ?lang wins over everything', () => {
    expect(pickLang('en', 'ko', ['ko-KR'])).toBe('en')
    expect(pickLang('ko', 'en', ['en-US'])).toBe('ko')
  })
  it('saved choice wins over the browser language', () => {
    expect(pickLang(null, 'en', ['ko-KR'])).toBe('en')
    expect(pickLang(undefined, 'ko', ['en-US'])).toBe('ko')
  })
  it('first visit: Korean browsers get Korean, everything else English', () => {
    expect(pickLang(null, null, ['ko-KR', 'en'])).toBe('ko')
    expect(pickLang(null, null, ['ko'])).toBe('ko')
    expect(pickLang(null, null, ['ja-JP', 'ko-KR'])).toBe('en') // only the first language counts
    expect(pickLang(null, null, ['en-US'])).toBe('en')
    expect(pickLang(null, null, [])).toBe('en')
  })
  it('invalid values are ignored', () => {
    expect(pickLang('xx', null, ['ko-KR'])).toBe('ko')
    expect(pickLang('xx', 'yy', ['en-US'])).toBe('en')
    expect(pickLang('', '', [])).toBe('en')
  })
})

describe('message tables', () => {
  it('English and Korean have exactly the same keys and no empty strings', () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort())
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en ${k}`).not.toBe('')
    for (const [k, v] of Object.entries(ko)) expect(v.trim(), `ko ${k}`).not.toBe('')
  })
  it('both languages use the same {placeholders} for every key', () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(names(ko[k]), k).toBe(names(en[k]))
  })
})

describe('language menu', () => {
  it('starts in English for an English browser', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: en['load.title'] })).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
  })

  it('choosing 한국어 changes titles and buttons, is saved, sets <html lang>, and survives a re-render', () => {
    const first = renderApp()
    fireEvent.change(screen.getByTestId('lang-menu'), { target: { value: 'ko' } })
    expect(screen.getByRole('heading', { name: ko['load.title'] })).toBeTruthy()
    expect(screen.getByText(ko['load.sampleBinary'])).toBeTruthy()
    expect(screen.queryByText(en['load.sampleBinary'])).toBeNull()
    expect(window.localStorage.getItem('agreelens.lang')).toBe('ko')
    expect(document.documentElement.lang).toBe('ko')
    first.unmount()

    renderApp() // the browser still says English, the saved choice wins
    expect(screen.getByRole('heading', { name: ko['load.title'] })).toBeTruthy()
    expect((screen.getByTestId('lang-menu') as HTMLSelectElement).value).toBe('ko')
  })

  it('first visit with a Korean browser shows Korean and remembers it', () => {
    setBrowserLanguages(['ko-KR'])
    renderApp()
    expect(screen.getByRole('heading', { name: ko['load.title'] })).toBeTruthy()
    expect(window.localStorage.getItem('agreelens.lang')).toBe('ko')
  })

  it('a saved English choice is not overridden by a Korean browser later', () => {
    window.localStorage.setItem('agreelens.lang', 'en')
    setBrowserLanguages(['ko-KR'])
    renderApp()
    expect(screen.getByRole('heading', { name: en['load.title'] })).toBeTruthy()
  })

  it('?lang=ko in the address is an explicit choice and is saved', () => {
    window.history.replaceState({}, '', '/?lang=ko')
    renderApp()
    expect(screen.getByRole('heading', { name: ko['load.title'] })).toBeTruthy()
    expect(window.localStorage.getItem('agreelens.lang')).toBe('ko')
  })

  it('an invalid ?lang is ignored', () => {
    window.history.replaceState({}, '', '/?lang=xx')
    renderApp()
    expect(screen.getByRole('heading', { name: en['load.title'] })).toBeTruthy()
  })

  it('the language can be switched on the result screen too', () => {
    window.history.replaceState({}, '', '/?sample=binary&lang=en')
    renderApp()
    expect(screen.getByText(en['card.kappa'])).toBeTruthy()
    fireEvent.change(screen.getByTestId('lang-menu'), { target: { value: 'ko' } })
    expect(screen.getByText(ko['card.kappa'])).toBeTruthy()
    expect(screen.getByText(ko['tab.matrix'])).toBeTruthy()
  })
})
