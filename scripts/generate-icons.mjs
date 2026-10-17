// Generates the PWA icon set from the same geometry as public/favicon.svg.
//
//   node scripts/generate-icons.mjs
//
// The icons are committed, so this only has to be re-run when the brand mark
// or the palette changes. No dependencies: PNGs are encoded with node:zlib.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = [0x1c, 0x15, 0x28]
const RING = [0xc4, 0xa0, 0xff]
const DOT = [0x8b, 0x5c, 0xf6]

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed), 0)
  return Buffer.concat([length, typed, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- rasterising ------------------------------------------------------------

const SUPERSAMPLE = 4

function insideRoundedRect(x, y, size, corner) {
  if (corner <= 0) return true
  const cx = Math.min(Math.max(x, corner), size - corner)
  const cy = Math.min(Math.max(y, corner), size - corner)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= corner * corner
}

/**
 * @param size    output edge length in px
 * @param rounded draw the squircle background (false = full bleed, for masks)
 */
function render(size, rounded) {
  const buf = Buffer.alloc(size * size * 4)
  const scale = size / 64 // favicon.svg uses a 64x64 viewBox
  const centre = 32 * scale
  const ringRadius = 18 * scale
  const ringHalf = 2 * scale
  const innerRadius = ringRadius - ringHalf
  const outerRadius = ringRadius + ringHalf
  const dotRadius = 6 * scale
  const corner = rounded ? 16 * scale : 0
  const samples = SUPERSAMPLE * SUPERSAMPLE

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let covered = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = x + (sx + 0.5) / SUPERSAMPLE
          const py = y + (sy + 0.5) / SUPERSAMPLE
          if (!insideRoundedRect(px, py, size, corner)) continue
          const dx = px - centre
          const dy = py - centre
          const distance = Math.hypot(dx, dy)
          const colour =
            distance <= dotRadius
              ? DOT
              : distance >= innerRadius && distance <= outerRadius
                ? RING
                : BG
          r += colour[0]
          g += colour[1]
          b += colour[2]
          covered += 1
        }
      }
      const i = (y * size + x) * 4
      if (covered) {
        buf[i] = Math.round(r / covered)
        buf[i + 1] = Math.round(g / covered)
        buf[i + 2] = Math.round(b / covered)
        buf[i + 3] = Math.round((255 * covered) / samples)
      }
    }
  }
  return buf
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'icon-maskable-192.png', size: 192, rounded: false },
  { file: 'icon-maskable-512.png', size: 512, rounded: false },
  // iOS masks the home screen icon itself and dislikes alpha.
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
]

mkdirSync(OUT_DIR, { recursive: true })
for (const { file, size, rounded } of TARGETS) {
  const png = encodePng(size, render(size, rounded))
  writeFileSync(resolve(OUT_DIR, file), png)
  console.log(`icons/${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
