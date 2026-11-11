// localStorage that never throws (some browsers block it for file:// pages or in private mode).

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the app keeps working, the choice is just not remembered
  }
}

export const LANG_KEY = 'agreelens.lang'
export const NOTES_PREFIX = 'agreelens.notes.'

/** Short stable hash (FNV-1a) used to key notes per file. */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

/** File fingerprint: name + row count + column names. Notes are stored under it. */
export function fingerprint(fileName: string, rowCount: number, fields: readonly string[]): string {
  return hash(`${fileName}\n${rowCount}\n${fields.join('\u0001')}`)
}

export function loadNotes(fp: string): Record<string, string> {
  const raw = readStorage(NOTES_PREFIX + fp)
  if (!raw) return {}
  try {
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveNotes(fp: string, notes: Record<string, string>): void {
  const cleaned = Object.fromEntries(Object.entries(notes).filter(([, v]) => v.trim() !== ''))
  writeStorage(NOTES_PREFIX + fp, Object.keys(cleaned).length ? JSON.stringify(cleaned) : null)
}
