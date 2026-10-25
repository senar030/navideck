/*
 * electron-builder packs the `desktop` folder, so the built web app has to live
 * inside it. The web build stays the single source; this only copies it over.
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const source = join(root, 'dist')
const target = join(here, '..', 'dist')

if (!existsSync(join(source, 'index.html'))) {
  console.error('dist/index.html fehlt. Zuerst im Projektordner `npm run build` ausführen.')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true })
console.log('desktop/dist vorbereitet')
