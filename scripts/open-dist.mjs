// npm start: print the path of the built page and open it in the default browser.
// No browser is opened in CI or with --no-open:  npm start -- --no-open
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url))
if (!existsSync(file)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}
const url = pathToFileURL(file).href
console.log(`agreelens is ready: ${file}`)
console.log(`Open ${url} in your browser. The file works on its own; you can copy it anywhere.`)

const skip = process.argv.includes('--no-open') || process.env.CI
if (!skip) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
  child.on('error', () => console.log('(could not open a browser automatically; open the path above yourself)'))
  child.unref()
}
