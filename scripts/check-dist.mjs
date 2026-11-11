// Checks that dist/ is one self-contained HTML file that cannot talk to the network.
//   npm run build && node scripts/check-dist.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const problems = []

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing. Run `npm run build` first.')
  process.exit(1)
}

// 1. single file
const files = readdirSync(dist, { recursive: true })
if (files.length !== 1 || files[0] !== 'index.html') problems.push(`dist must contain only index.html, found: ${files.join(', ')}`)

const html = readFileSync(join(dist, 'index.html'), 'utf8')

// 2. Content-Security-Policy that blocks every outgoing request
const meta = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i)
const csp = meta ? (meta[0].match(/content="([^"]*)"/) ?? [])[1] ?? '' : ''
if (!meta) problems.push('no Content-Security-Policy meta tag')
for (const need of ["default-src 'none'", "connect-src 'none'"]) {
  if (!csp.includes(need)) problems.push(`CSP is missing ${need}`)
}

// 3. no external references: look at the markup only (script and style bodies are code, not references)
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>')
const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
let external = 0
for (const m of markup.matchAll(/<script\b[^>]*\bsrc=/gi)) external++, problems.push(`external script tag: ${m[0]}`)
for (const m of markup.matchAll(/<link\b[^>]*>/gi)) external++, problems.push(`link tag: ${m[0]}`)
for (const m of markup.matchAll(/\b(?:src|href|action|poster|data)=["']\s*(?:https?:)?\/\//gi)) external++, problems.push(`external reference: ${m[0]}`)
for (const m of css.matchAll(/@import|url\(\s*["']?(?:https?:)?\/\//gi)) external++, problems.push(`external CSS reference: ${m[0]}`)

// 4. our own source must not use network APIs
const NETWORK = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon)/
for (const f of readdirSync(join(root, 'src'), { recursive: true })) {
  if (!/\.(ts|tsx)$/.test(String(f))) continue
  const text = readFileSync(join(root, 'src', String(f)), 'utf8')
  if (NETWORK.test(text)) problems.push(`src/${f} uses a network API`)
}

if (problems.length > 0) {
  console.error('dist check failed:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log(`dist ok: index.html (single file, CSP connect-src 'none', ${external} external refs)`)
