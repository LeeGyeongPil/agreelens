// Runs the built dist/index.html inside jsdom under a file:// address and checks that it really draws.
// Unit tests run the source; this catches problems that only exist in the bundled, minified page
// (for example a bundler breaking a dependency). It is not a replacement for opening the file in a browser.
//   npm run build && node scripts/smoke-dist.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const dist = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const html = readFileSync(dist, 'utf8')
const m = html.match(/<script type="module" crossorigin>([\s\S]*)<\/script>/)
if (!m) {
  console.error('smoke: inline module script not found in dist/index.html')
  process.exit(1)
}
const page = html.replace(m[0], '')
const failures = []

async function open(query) {
  const dom = new JSDOM(page, { url: `file://${dist}${query}`, runScripts: 'outside-only', pretendToBeVisual: true })
  dom.window.addEventListener('error', (e) => failures.push(`${query}: ${e.message}`))
  dom.window.eval(m[1])
  await new Promise((r) => setTimeout(r, 200))
  return dom
}

const text = (dom) => dom.window.document.body.textContent ?? ''

// 1. start screen and the two samples, English and Korean
{
  const dom = await open('?lang=en')
  if (!text(dom).includes('Load your labels')) failures.push('start screen (en) did not render')
  dom.window.close()
}
for (const [q, needle] of [
  ['?sample=binary&view=summary&lang=en', "Cohen's kappa"],
  ['?sample=binary&view=matrix&cell=fail,pass&lang=ko', '혼동 행렬'],
  ['?sample=binary&view=review&cell=fail,pass&lang=en', 'Showing human "fail", judge "pass": 12 rows'],
  ['?sample=ordinal&view=summary&lang=ko', '사람끼리의 알파'],
]) {
  const dom = await open(q)
  if (!text(dom).includes(needle)) failures.push(`${q}: "${needle}" not found`)
  if (dom.window.document.body.dataset.ready !== '1') failures.push(`${q}: ready flag not set`)
  dom.window.close()
}

// 2. upload a CSV (this runs the CSV parser inside the bundle)
{
  const dom = await open('?lang=en')
  const w = dom.window
  const input = w.document.querySelector('input[type=file]')
  const file = new w.File(['id,human,judge\n1,pass,pass\n2,fail,pass\n3,pass,pass\n'], 'x.csv', { type: 'text/csv' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new w.Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 300))
  if (!text(dom).includes('Map your columns')) failures.push('CSV upload did not reach the mapping screen')
  if (!text(dom).includes('3 comparable rows')) failures.push('CSV upload: preview missing')
  dom.window.close()
}

if (failures.length > 0) {
  console.error('smoke failed:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('smoke ok: dist/index.html renders under file:// (start screen, 2 samples x en/ko, CSV upload)')
