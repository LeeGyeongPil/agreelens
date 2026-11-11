// The example files shipped in examples/ (used in the README) must load and analyze without errors.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/core/analyze'
import { guessMapping, validateMapping } from '../../src/core/mapping'
import { parseTable } from '../../src/core/parse'

const read = (name: string) => readFileSync(new URL(`../../examples/${name}`, import.meta.url), 'utf8')

describe('files in examples/', () => {
  it('my-judge-run.csv: mapping is guessed and the blank human cell is left out', () => {
    const t = parseTable(read('my-judge-run.csv'), undefined, 'my-judge-run.csv')
    expect(t.errors).toEqual([])
    const m = guessMapping(t.fields)
    expect(validateMapping(t.fields, m)).toEqual([])
    const r = analyze(t.rows, m)
    expect(r.n).toBe(11)
    expect(r.exclusions.humanMissing).toBe(1)
  })

  it('my-judge-run.jsonl: nested keys become dot paths', () => {
    const t = parseTable(read('my-judge-run.jsonl'), undefined, 'my-judge-run.jsonl')
    expect(t.errors).toEqual([])
    expect(t.fields).toContain('scores.judge')
    const m = { ...guessMapping(t.fields), scale: 'ordinal' as const }
    expect(m.humanColumns).toEqual(['scores.human'])
    expect(analyze(t.rows, m).n).toBe(6)
  })

  it('three-raters.tsv: three human columns, majority reference', () => {
    const t = parseTable(read('three-raters.tsv'), undefined, 'three-raters.tsv')
    expect(t.errors).toEqual([])
    const m = { ...guessMapping(t.fields), scale: 'ordinal' as const, order: ['bad', 'ok', 'good'] }
    expect(m.humanColumns).toEqual(['rater_a', 'rater_b', 'rater_c'])
    expect(m.judgeColumn).toBe('judge')
    const r = analyze(t.rows, m, { bootstrapIters: 100 })
    expect(r.n).toBe(8)
    expect(r.labels).toEqual(['bad', 'ok', 'good'])
    expect(r.alphas[0].humans.value).not.toBeNull()
  })
})
