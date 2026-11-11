import { isSampleId, type SampleId } from '../samples'

export type View = 'summary' | 'matrix' | 'review'

export interface UrlState {
  sample: SampleId | null
  view: View
  /** [human label, judge label] */
  cell: [string, string] | null
  lang: string | null
}

/** Read ?sample=binary|ordinal&view=summary|matrix|review&cell=<human>,<judge>&lang=en|ko (used for shareable and screenshot URLs). */
export function readUrlState(search: string): UrlState {
  const q = new URLSearchParams(search)
  const sample = q.get('sample')
  const view = q.get('view')
  const cell = q.get('cell')
  let parsed: [string, string] | null = null
  if (cell) {
    const i = cell.indexOf(',')
    if (i > 0 && i < cell.length - 1) parsed = [cell.slice(0, i), cell.slice(i + 1)]
  }
  return {
    sample: isSampleId(sample) ? sample : null,
    view: view === 'matrix' || view === 'review' ? view : 'summary',
    cell: parsed,
    lang: q.get('lang'),
  }
}
