#!/usr/bin/env node
/*
 * Downloads the desktop release assets (Windows installer and Linux AppImage)
 * into ./release. Without an argument the newest desktop-v* release is used.
 *
 *   node scripts/fetch-desktop-release.mjs
 *   node scripts/fetch-desktop-release.mjs 1.6.0
 */
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const REPO = 'senar030/navideck'
const OUT = path.resolve('release')
const wanted = process.argv[2]

async function api(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'navideck-release-fetch' },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  return response.json()
}

const releases = await api(`https://api.github.com/repos/${REPO}/releases?per_page=30`)
const release = wanted
  ? releases.find((item) => item.tag_name === `desktop-v${wanted.replace(/^desktop-v/, '')}`)
  : releases.find((item) => item.tag_name.startsWith('desktop-v'))

if (!release) {
  console.error(wanted ? `Release desktop-v${wanted} not found.` : 'No desktop release found.')
  process.exit(1)
}

const assets = release.assets.filter((item) => /\.(exe|AppImage)$/i.test(item.name))
if (!assets.length) {
  console.error(`Release ${release.tag_name} has no .exe or .AppImage assets.`)
  process.exit(1)
}

await mkdir(OUT, { recursive: true })
for (const asset of assets) {
  const target = path.join(OUT, asset.name)
  await rm(target, { force: true })
  const response = await fetch(asset.browser_download_url)
  if (!response.ok || !response.body) throw new Error(`Download failed: ${asset.name}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target))
  console.log(`${asset.name} → ${target}`)
}
