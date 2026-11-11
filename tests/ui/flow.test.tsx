// @vitest-environment jsdom
// AC-7: interactive review flow - sample -> summary -> matrix cell -> disagreement rows -> note -> CSV.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { analyze } from '../../src/core/analyze'
import { parseTable } from '../../src/core/parse'
import { I18nProvider } from '../../src/i18n/I18nProvider'
import { en } from '../../src/i18n/messages.en'
import { SAMPLES, sampleMapping } from '../../src/samples'
import * as download from '../../src/ui/download'

vi.mock('../../src/ui/download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/download')>()
  return { ...actual, downloadText: vi.fn() }
})

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  )
}

const sample = SAMPLES.binary
const table = parseTable(sample.text, sample.kind, sample.fileName)
const expected = analyze(table.rows, sampleMapping('binary', table.fields))

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('agreelens.lang', 'en')
  window.history.replaceState({}, '', '/')
  vi.mocked(download.downloadText).mockClear()
})
afterEach(cleanup)

describe('review flow on the binary sample', () => {
  it('summary kappa equals the core result (3 decimals), and the sample is labelled as practice data', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    expect(screen.getByTestId('kappa-value').textContent).toBe(expected.kappa.value!.toFixed(3))
    expect(screen.getByTestId('n-value').textContent).toBe(String(expected.n))
    expect(screen.getByText(en['mock.badge'])).toBeTruthy()
    expect(screen.getAllByTestId('warning-prevalence').length).toBeGreaterThan(0)
  })

  it('clicking the (fail, pass) cell filters the disagreement table to that many rows', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    fireEvent.click(screen.getByTestId('tab-matrix'))
    const cell = screen.getByTestId('cell-fail-pass')
    expect(cell.textContent).toBe(String(expected.confusion.matrix[0][1]))
    fireEvent.click(cell)
    expect(screen.getByTestId('review')).toBeTruthy()
    expect(screen.getAllByTestId('disagreement-row')).toHaveLength(expected.confusion.matrix[0][1])
    expect(screen.getByTestId('review-filter').textContent).toContain('12 rows')
    // diagonal cells cannot be opened (there is nothing to review)
    fireEvent.click(screen.getByTestId('tab-matrix'))
    expect((screen.getByTestId('cell-pass-pass') as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows all disagreements without a filter, and the other off-diagonal cell filters to its own count', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    fireEvent.click(screen.getByTestId('tab-review'))
    expect(screen.getAllByTestId('disagreement-row')).toHaveLength(16)
    fireEvent.click(screen.getByTestId('tab-matrix'))
    fireEvent.click(screen.getByTestId('cell-pass-fail'))
    expect(screen.getAllByTestId('disagreement-row')).toHaveLength(expected.confusion.matrix[1][0])
  })

  it('a note is saved in localStorage and appears in the CSV with a note column', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    fireEvent.click(screen.getByTestId('tab-matrix'))
    fireEvent.click(screen.getByTestId('cell-fail-pass'))
    const boxes = screen.getAllByRole('textbox')
    const noteBox = boxes[boxes.length - 1] // a row without the pre-filled example note
    fireEvent.change(noteBox, { target: { value: 'judge ignores missing evidence' } })

    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith('agreelens.notes.'))
    expect(keys).toHaveLength(1)
    expect(window.localStorage.getItem(keys[0])).toContain('judge ignores missing evidence')

    fireEvent.click(screen.getByTestId('export-csv'))
    expect(download.downloadText).toHaveBeenCalledTimes(1)
    const [name, text, mime] = vi.mocked(download.downloadText).mock.calls[0]
    expect(name).toMatch(/\.notes\.csv$/)
    expect(mime).toBe('text/csv')
    const header = text.split('\n')[0].split(',')
    expect(header[header.length - 1]).toBe('note')
    expect(text).toContain('judge ignores missing evidence')
  })

  it('notes survive a reload (same file fingerprint) and can be cleared', () => {
    const first = renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    fireEvent.click(screen.getByTestId('tab-review'))
    const boxes = screen.getAllByRole('textbox')
    fireEvent.change(boxes[boxes.length - 1], { target: { value: 'remember me' } })
    first.unmount()

    renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    fireEvent.click(screen.getByTestId('tab-review'))
    expect(screen.getAllByRole('textbox').some((b) => (b as HTMLTextAreaElement).value === 'remember me')).toBe(true)

    fireEvent.click(screen.getByTestId('clear-notes'))
    expect(screen.queryByDisplayValue('remember me')).toBeNull()
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith('agreelens.notes.'))).toHaveLength(0)
  })

  it('text can be expanded per row', () => {
    window.history.replaceState({}, '', '/?sample=binary&view=review&cell=fail,pass')
    renderApp()
    const row = screen.getAllByTestId('disagreement-row')[0]
    expect(within(row).queryByText('judge_reason')).toBeNull()
    fireEvent.click(within(row).getByText(en['review.expand']))
    expect(within(row).getByText('judge_reason')).toBeTruthy()
  })

  it('exports the HTML and JSON reports through the download helper', () => {
    renderApp()
    fireEvent.click(screen.getByTestId('sample-binary'))
    fireEvent.click(screen.getByTestId('export-html'))
    fireEvent.click(screen.getByTestId('export-json'))
    const calls = vi.mocked(download.downloadText).mock.calls
    expect(calls[0][0]).toMatch(/\.agreelens\.en\.html$/)
    expect(calls[0][1]).toContain('<html lang="en">')
    expect(JSON.parse(calls[1][1]).tool.name).toBe('agreelens')
  })
})

describe('address options for sharing and screenshots', () => {
  it('?sample&view&cell&lang open the exact screen and set the ready flag', () => {
    delete document.body.dataset.ready
    window.history.replaceState({}, '', '/?sample=binary&view=review&cell=fail,pass&lang=ko')
    renderApp()
    expect(screen.getAllByTestId('disagreement-row')).toHaveLength(12)
    expect(screen.getByText('예시 메모')).toBeTruthy() // the pre-filled example note is marked
    expect(document.body.dataset.ready).toBe('1')
  })

  it('ordinal sample summary shows the weighted kappa and both alphas', () => {
    window.history.replaceState({}, '', '/?sample=ordinal&view=summary')
    renderApp()
    expect(screen.getByTestId('kappa-quadratic-value')).toBeTruthy()
    expect(screen.getByTestId('alpha-humans-ordinal')).toBeTruthy()
    expect(screen.getByTestId('alpha-judge-ordinal')).toBeTruthy()
    expect(screen.queryByTestId('warning-prevalence')).toBeNull()
  })

  it('a ?cell that does not exist is ignored', () => {
    window.history.replaceState({}, '', '/?sample=binary&view=review&cell=nope,pass')
    renderApp()
    expect(screen.getAllByTestId('disagreement-row')).toHaveLength(16)
  })
})
