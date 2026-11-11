// AC-4: normal data must not produce errors or warnings; parsing and normalizing behave as documented.
import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/core/analyze'
import { emptyMapping, guessMapping, validateMapping } from '../../src/core/mapping'
import { buildCanonicalizer, defaultNormalize, summarizeLabels } from '../../src/core/normalize'
import { detectKind, parseTable } from '../../src/core/parse'
import ref from '../fixtures/ref.json'
import { mappingFor, rowsFrom } from '../helpers'

describe('parseTable: files that are fine must parse without errors', () => {
  it('CSV with BOM, quoted commas, line breaks inside a cell and Korean text', () => {
    const csv = '﻿id,question,human,judge\n1,"a, b",pass,fail\n2,"줄\n바꿈 한국어",fail,fail\n3,"say ""hi""",pass,pass\n'
    const t = parseTable(csv, 'csv')
    expect(t.errors).toEqual([])
    expect(t.fields).toEqual(['id', 'question', 'human', 'judge'])
    expect(t.rows).toHaveLength(3)
    expect(t.rows[0].question).toBe('a, b')
    expect(t.rows[1].question).toBe('줄\n바꿈 한국어')
    expect(t.rows[2].question).toBe('say "hi"')
  })

  it('CRLF line endings and a trailing blank line', () => {
    const t = parseTable('human,judge\r\npass,pass\r\nfail,pass\r\n\r\n', 'csv')
    expect(t.errors).toEqual([])
    expect(t.rows).toHaveLength(2)
  })

  it('TSV', () => {
    const t = parseTable('id\thuman\tjudge\n1\tpass\tfail\n2\tfail\tfail\n', 'tsv')
    expect(t.errors).toEqual([])
    expect(t.rows[0]).toEqual({ id: '1', human: 'pass', judge: 'fail' })
  })

  it('JSONL with nested keys flattened to dot paths, blank lines, BOM', () => {
    const text = '﻿{"id":1,"scores":{"human":"pass","judge":"fail"},"input":{"q":"질문"}}\n\n{"id":2,"scores":{"human":"fail","judge":null}}\n'
    const t = parseTable(text, 'jsonl')
    expect(t.errors).toEqual([])
    expect(t.fields).toEqual(['id', 'scores.human', 'scores.judge', 'input.q'])
    expect(t.rows[0]['scores.judge']).toBe('fail')
    expect(t.rows[0]['input.q']).toBe('질문')
    expect(t.rows[1]['scores.judge']).toBe('') // null becomes a blank cell
  })

  it('guesses the file kind from the name, then from the content', () => {
    expect(detectKind('a.jsonl', '')).toBe('jsonl')
    expect(detectKind('a.tsv', '')).toBe('tsv')
    expect(detectKind('a.csv', '')).toBe('csv')
    expect(detectKind('x', '{"a":1}')).toBe('jsonl')
    expect(detectKind('x', 'a\tb\tc\n1\t2\t3')).toBe('tsv')
    expect(detectKind('x', 'a,b,c\n1,2,3')).toBe('csv')
  })
})

describe('parseTable: real problems are reported with a code and a position', () => {
  it('empty file / header only', () => {
    expect(parseTable('', 'csv').errors.map((e) => e.code)).toEqual(['empty_file'])
    expect(parseTable('  \n', 'jsonl').errors.map((e) => e.code)).toEqual(['empty_file'])
    expect(parseTable('human,judge\n', 'csv').errors.map((e) => e.code)).toEqual(['no_rows'])
  })
  it('an invalid JSONL line is reported with its line number and the other lines are kept', () => {
    const t = parseTable('{"human":"a","judge":"a"}\n{oops\n[1,2]\n{"human":"b","judge":"a"}\n', 'jsonl')
    expect(t.rows).toHaveLength(2)
    expect(t.errors.map((e) => [e.code, e.row])).toEqual([
      ['jsonl_line', 2],
      ['jsonl_not_object', 3],
    ])
  })
  it('a CSV row with the wrong number of cells is reported', () => {
    const t = parseTable('human,judge\npass,pass\nfail\n', 'csv')
    expect(t.errors.length).toBeGreaterThan(0)
    expect(t.errors[0].code).toBe('csv_row')
    expect(t.rows).toHaveLength(2)
  })
})

describe('labels are normalized the way users expect', () => {
  it('CSV "1" and JSONL 1 are the same label', () => {
    const csv = parseTable('human,judge\n1,2\n2,2\n3,3\n', 'csv')
    const jsonl = parseTable('{"human":1,"judge":2}\n{"human":2,"judge":2}\n{"human":3,"judge":3}\n', 'jsonl')
    const m = mappingFor(['human'], 'judge', { scale: 'ordinal' })
    const a = analyze(csv.rows, m)
    const b = analyze(jsonl.rows, m)
    expect(a.labels).toEqual(['1', '2', '3'])
    expect(b.labels).toEqual(a.labels)
    expect(b.confusion.matrix).toEqual(a.confusion.matrix)
    expect(b.kappa.value).toBe(a.kappa.value)
  })

  it('"1", "1.0" and " 01 " are one numeric label, and 10 sorts after 9', () => {
    const rows = rowsFrom({ human: ['1', '1.0', ' 01 ', '10', '9'], judge: ['1', '1', '1', '10', '9'] })
    const r = analyze(rows, mappingFor())
    expect(r.numericLabels).toBe(true)
    expect(r.labels).toEqual(['1', '9', '10'])
  })

  it('" Pass", "pass" and "PASS" are folded together by default', () => {
    const rows = rowsFrom({ human: [' Pass', 'pass', 'PASS', 'fail'], judge: ['pass', 'Pass ', 'pass', 'FAIL'] })
    const r = analyze(rows, mappingFor())
    expect(r.labels).toEqual(['fail', 'pass'])
    expect(r.agreement.value).toBe(1)
    const s = summarizeLabels(rows, ['human', 'judge'], defaultNormalize())
    expect(s.labels.find((l) => l.label === 'pass')?.variants.length).toBeGreaterThan(1)
  })

  it('cleaning can be switched off', () => {
    const rows = rowsFrom({ human: ['Pass', 'pass'], judge: ['pass', 'pass'] })
    const m = mappingFor(['human'], 'judge', { normalize: { trim: false, caseInsensitive: false, missingTokens: [''] } })
    expect(analyze(rows, m).labels).toEqual(['Pass', 'pass'])
  })

  it('missing tokens: blank, NA, N/A, null in any case; "none" is a normal label unless added', () => {
    const rows = rowsFrom({ human: ['', 'na', 'N/A', 'Null', 'none', 'pass'], judge: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass'] })
    const r = analyze(rows, mappingFor())
    expect(r.n).toBe(2)
    expect(r.exclusions.humanMissing).toBe(4)
    const custom = analyze(rows, mappingFor(['human'], 'judge', { normalize: { ...defaultNormalize(), missingTokens: ['', 'none'] } }))
    expect(custom.n).toBe(4)
  })

  it('merging two labels and leaving a label out', () => {
    const rows = rowsFrom({ human: ['ok', 'good', 'bad', 'unsure'], judge: ['good', 'good', 'bad', 'bad'] })
    const merged = analyze(rows, mappingFor(['human'], 'judge', { merge: { ok: 'good' }, excludedLabels: ['unsure'] }))
    expect(merged.labels).toEqual(['bad', 'good'])
    expect(merged.n).toBe(3)
    expect(merged.agreement.value).toBe(1)
  })

  it('canonicalizer: numbers only when every value is a number', () => {
    const rows = rowsFrom({ a: ['1', '2'], b: ['x', '2'] })
    expect(buildCanonicalizer(rows, ['a'], defaultNormalize()).numeric).toBe(true)
    expect(buildCanonicalizer(rows, ['a', 'b'], defaultNormalize()).numeric).toBe(false)
  })
})

describe('text ordinal labels need an explicit order', () => {
  const r = ref.string_ordinal
  const rows = rowsFrom({ human: r.human, judge: r.judge })
  it('weighted kappa with the order low < mid < high equals scikit-learn on integers', () => {
    const m = mappingFor(['human'], 'judge', { scale: 'ordinal', order: r.order })
    const res = analyze(rows, m)
    expect(res.labels).toEqual(['low', 'mid', 'high'])
    expect(res.kappaLinear?.value).toBeCloseTo(r.kappa_linear_ordered, 12)
    expect(res.kappaQuadratic?.value).toBeCloseTo(r.kappa_quadratic_ordered, 12)
  })
  it('without the order the labels are alphabetical (high, low, mid) and the result differs', () => {
    const res = analyze(rows, mappingFor(['human'], 'judge', { scale: 'ordinal' }))
    expect(res.labels).toEqual(['high', 'low', 'mid'])
    expect(res.kappaQuadratic?.value).toBeCloseTo(r.kappa_quadratic_alphabetical, 12)
    expect(Math.abs(res.kappaQuadratic!.value! - r.kappa_quadratic_ordered)).toBeGreaterThan(0.05)
  })
})

describe('no false alarms on normal data', () => {
  const balanced = (n: number, agree: number) => {
    const human: string[] = []
    const judge: string[] = []
    for (let i = 0; i < n; i++) {
      const h = i % 2 === 0 ? 'pass' : 'fail'
      human.push(h)
      judge.push(i < agree ? h : h === 'pass' ? 'fail' : 'pass')
    }
    return rowsFrom({ human, judge })
  }

  it('balanced binary sample: no warnings', () => {
    const r = analyze(balanced(60, 54), mappingFor())
    expect(r.warnings).toEqual([])
    expect(r.kappa.value).toBeGreaterThan(0.7)
  })

  it('uneven but not extreme three-class sample (40/35/25 %): no warnings', () => {
    const labels = ['a', 'b', 'c']
    const human: string[] = []
    const judge: string[] = []
    for (let i = 0; i < 100; i++) {
      const h = i < 40 ? 'a' : i < 75 ? 'b' : 'c'
      human.push(h)
      judge.push(i % 10 === 0 ? labels[(labels.indexOf(h) + 1) % 3] : h)
    }
    const r = analyze(rowsFrom({ human, judge }), mappingFor())
    expect(r.warnings).toEqual([])
    expect(r.mcc).toBeNull() // MCC is shown for two labels only
  })

  it('thresholds: 84% top label is quiet, 85% warns; 50 rows is quiet, 49 warns', () => {
    const skew = (topShare: number, n = 100) => {
      const top = Math.round(topShare * n)
      const human = Array.from({ length: n }, (_, i) => (i < top ? 'pass' : 'fail'))
      const judge = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'pass' : 'fail')) // judge is not skewed
      return rowsFrom({ human, judge })
    }
    expect(analyze(skew(0.84), mappingFor()).warnings.map((w) => w.code)).toEqual([])
    expect(analyze(skew(0.85), mappingFor()).warnings.map((w) => w.code)).toEqual(['prevalence'])
    expect(analyze(balanced(50, 45), mappingFor()).warnings).toEqual([])
    expect(analyze(balanced(49, 45), mappingFor()).warnings.map((w) => w.code)).toEqual(['small_sample'])
  })

  it('each person using a different label mix does not trigger warnings or NA', () => {
    const rows = rowsFrom({
      h1: ['1', '2', '3', '4', '5', '3', '2', '4', '5', '1', '3', '4'],
      h2: ['1', '2', '3', '4', '4', '3', '2', '5', '5', '2', '3', '4'],
      h3: ['2', '2', '3', '5', '5', '3', '1', '4', '5', '1', '3', '3'],
      judge: ['1', '3', '3', '4', '5', '3', '2', '4', '4', '1', '3', '4'],
    })
    const r = analyze(rows, mappingFor(['h1', 'h2', 'h3'], 'judge', { scale: 'ordinal' }), { bootstrapIters: 200 })
    expect(r.kappa.value).not.toBeNull()
    expect(r.alphas.every((a) => a.humans.value !== null && a.withJudge.value !== null)).toBe(true)
    expect(r.perRater).toHaveLength(3)
    expect(r.warnings.map((w) => w.code)).toEqual(['small_sample']) // only the honest "12 rows" note
  })
})

describe('mapping guess and validation', () => {
  it('guesses roles from common column names, including nested JSONL paths', () => {
    const m = guessMapping(['id', 'question', 'answer', 'human', 'judge', 'judge_reason'])
    expect(m.idColumn).toBe('id')
    expect(m.humanColumns).toEqual(['human'])
    expect(m.judgeColumn).toBe('judge')
    expect(m.textColumns).toEqual(['question', 'answer', 'judge_reason'])
    const n = guessMapping(['scores.human_a', 'scores.human_b', 'scores.judge', 'input.prompt'])
    expect(n.humanColumns).toEqual(['scores.human_a', 'scores.human_b'])
    expect(n.judgeColumn).toBe('scores.judge')
  })

  it('reports unusable mappings with a code', () => {
    const fields = ['a', 'b']
    expect(validateMapping(fields, emptyMapping()).map((i) => i.code)).toEqual(['no_human_column', 'no_judge_column'])
    expect(validateMapping(fields, { ...emptyMapping(), humanColumns: ['a'], judgeColumn: 'a' }).map((i) => i.code)).toEqual(['judge_in_humans'])
    expect(validateMapping(fields, { ...emptyMapping(), humanColumns: ['zzz'], judgeColumn: 'b' }).map((i) => i.code)).toEqual(['unknown_column'])
    expect(
      validateMapping(fields, { ...emptyMapping(), humanColumns: ['a'], judgeColumn: 'b', reference: { kind: 'column', column: 'b' } }).map((i) => i.code),
    ).toEqual(['reference_column_not_human'])
    expect(validateMapping(fields, { ...emptyMapping(), humanColumns: ['a'], judgeColumn: 'b' })).toEqual([])
  })
})
