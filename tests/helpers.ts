import { emptyMapping } from '../src/core/mapping'
import type { Mapping } from '../src/core/types'

/** Build table rows with columns human / judge (and optional human2 ...) from label arrays. */
export function rowsFrom(columns: Record<string, readonly (string | number)[]>): Record<string, string>[] {
  const names = Object.keys(columns)
  const n = columns[names[0]].length
  return Array.from({ length: n }, (_, i) => Object.fromEntries(names.map((c) => [c, String(columns[c][i])])))
}

export function mappingFor(humans: string[] = ['human'], judge = 'judge', patch: Partial<Mapping> = {}): Mapping {
  return { ...emptyMapping(), humanColumns: humans, judgeColumn: judge, ...patch }
}
