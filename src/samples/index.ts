// Practice samples bundled into the page with ?raw (synthetic data made by scripts/make-samples.mjs).
import { guessMapping } from '../core/mapping'
import type { Mapping } from '../core/types'
import binaryText from './binary-pass-fail.csv?raw'
import ordinalText from './ordinal-3raters.jsonl?raw'

export type SampleId = 'binary' | 'ordinal'

export interface Sample {
  id: SampleId
  fileName: string
  kind: 'csv' | 'jsonl'
  text: string
}

export const SAMPLES: Record<SampleId, Sample> = {
  binary: { id: 'binary', fileName: 'binary-pass-fail.csv', kind: 'csv', text: binaryText },
  ordinal: { id: 'ordinal', fileName: 'ordinal-3raters.jsonl', kind: 'jsonl', text: ordinalText },
}

export function isSampleId(v: unknown): v is SampleId {
  return v === 'binary' || v === 'ordinal'
}

/** Column mapping that goes with each sample. */
export function sampleMapping(id: SampleId, fields: readonly string[]): Mapping {
  const m = guessMapping(fields)
  if (id === 'binary') {
    m.scale = 'nominal'
    m.positive = 'pass'
  } else {
    m.scale = 'ordinal'
  }
  return m
}
