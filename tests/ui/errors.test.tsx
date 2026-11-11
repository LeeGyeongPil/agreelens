// @vitest-environment jsdom
// Error paths in both languages: unreadable files, bad column mapping, partly bad files, and the normal upload path.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../src/App'
import { I18nProvider } from '../../src/i18n/I18nProvider'
import { en } from '../../src/i18n/messages.en'
import { ko } from '../../src/i18n/messages.ko'
import type { Lang } from '../../src/i18n/translate'

const MSG = { en, ko }

function renderApp(lang: Lang) {
  window.localStorage.setItem('agreelens.lang', lang)
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  )
}

function upload(name: string, text: string) {
  const file = new File([text], name, { type: 'text/plain' })
  fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
})
afterEach(cleanup)

for (const lang of ['en', 'ko'] as const) {
  const m = MSG[lang]
  describe(`errors in ${lang}`, () => {
    it('empty file', async () => {
      renderApp(lang)
      upload('empty.csv', '')
      const box = await screen.findByTestId('load-errors')
      expect(box.textContent).toContain(m['err.empty_file'])
      expect(box.textContent).toContain(m['load.errors'])
    })

    it('JSONL where every line is broken: line numbers and reason are shown', async () => {
      renderApp(lang)
      upload('bad.jsonl', '{oops\nnot json\n')
      const box = await screen.findByTestId('load-errors')
      expect(box.textContent).toContain(m['err.jsonl_line'].replace('{row}', '1').split('{detail}')[0])
      expect(box.textContent).toContain(m['err.jsonl_line'].replace('{row}', '2').split('{detail}')[0])
    })

    it('JSONL line that is not an object', async () => {
      renderApp(lang)
      upload('arr.jsonl', '[1,2,3]\n')
      const box = await screen.findByTestId('load-errors')
      expect(box.textContent).toContain(m['err.jsonl_not_object'].replace('{row}', '1'))
    })

    it('header only', async () => {
      renderApp(lang)
      upload('h.csv', 'human,judge\n')
      const box = await screen.findByTestId('load-errors')
      expect(box.textContent).toContain(m['err.no_rows'])
    })

    it('column mapping error: no human / judge column could be guessed', async () => {
      renderApp(lang)
      upload('odd.csv', 'a,b\n1,2\n2,2\n')
      const issues = await screen.findByTestId('mapping-issues')
      expect(issues.textContent).toContain(m['issue.no_human_column'])
      expect(issues.textContent).toContain(m['issue.no_judge_column'])
      expect((screen.getByTestId('analyze') as HTMLButtonElement).disabled).toBe(true)
    })

    it('column mapping error: the same column chosen as human and judge', async () => {
      renderApp(lang)
      upload('odd.csv', 'a,b\n1,2\n2,2\n')
      await screen.findByTestId('mapping-issues')
      fireEvent.click(screen.getByTestId('human-a'))
      fireEvent.change(screen.getByTestId('judge-select'), { target: { value: 'a' } })
      const issues = screen.getByTestId('mapping-issues')
      expect(issues.textContent).toContain(m['issue.judge_in_humans'].replace('{column}', 'a'))
    })

    it('a file with a few bad lines still loads and lists the skipped lines', async () => {
      renderApp(lang)
      upload('part.jsonl', '{"human":"a","judge":"a"}\n{oops\n{"human":"b","judge":"a"}\n')
      const box = await screen.findByTestId('skipped-rows')
      expect(box.textContent).toContain(m['load.skipped'])
      expect(box.textContent).toContain(m['err.jsonl_line'].replace('{row}', '2').split('{detail}')[0])
      expect(screen.getByTestId('map-preview').textContent).toBe(m['map.preview'].replace('{n}', '2').replace('{excluded}', '0'))
    })
  })
}

describe('normal upload', () => {
  it('guesses the columns, shows the label table, and opens the results', async () => {
    renderApp('en')
    upload('judge-run.csv', 'id,human,judge\n1, Pass,pass\n2,fail,FAIL\n3,pass,pass\n4,fail,pass\n5,,pass\n')
    await screen.findByTestId('map-screen')
    expect(screen.getByTestId('map-preview').textContent).toBe(en['map.preview'].replace('{n}', '4').replace('{excluded}', '1'))
    expect(screen.getByTestId('label-table').textContent).toContain('" Pass"') // the raw spelling is visible
    fireEvent.click(screen.getByTestId('analyze'))
    await waitFor(() => expect(screen.getByTestId('kappa-value')).toBeTruthy())
    expect(screen.getByTestId('n-value').textContent).toBe('4')
    expect(screen.getByTestId('warning-small_sample')).toBeTruthy()
  })

  it('"edit mapping" goes back and a different judge column changes the numbers', async () => {
    renderApp('en')
    upload('two-judges.csv', 'human,judge,judge_b\npass,pass,fail\nfail,fail,pass\npass,pass,fail\nfail,fail,pass\n')
    await screen.findByTestId('map-screen')
    fireEvent.click(screen.getByTestId('analyze'))
    expect(screen.getByTestId('agreement-value').textContent).toBe('1.000')
    fireEvent.click(screen.getByTestId('edit-mapping'))
    fireEvent.change(screen.getByTestId('judge-select'), { target: { value: 'judge_b' } })
    fireEvent.click(screen.getByTestId('analyze'))
    expect(screen.getByTestId('agreement-value').textContent).toBe('0.000')
  })
})
