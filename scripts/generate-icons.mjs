/**
 * Generate app icons from original PNG design
 * Run with: node scripts/generate-icons.mjs
 */

import sharp from 'sharp'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Source image - the original design
const sourceImage = join(rootDir, 'public', 'Gemini_Generated_Image_tjhgtktjhgtktjhg.png')

// Icon sizes needed
const sizes = [16, 32, 64, 128, 256, 512, 1024]

// Ensure directories exist
const buildDir = join(rootDir, 'build')
const iconsDir = join(buildDir, 'icons')
const iconsetDir = join(buildDir, 'icon.iconset')
const publicDir = join(rootDir, 'public')

for (const dir of [buildDir, iconsDir, iconsetDir]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Create a rounded icon (macOS style)
 */
async function createRoundedIcon(inputPath, outputPath, size) {
  const roundedCorners = Buffer.from(
    `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.225}" ry="${size * 0.225}"/></svg>`
  )

  await sharp(inputPath)
    .resize(size, size, { fit: 'cover' })
    .composite([{
      input: roundedCorners,
      blend: 'dest-in'
    }])
    .png()
    .toFile(outputPath)
}

async function generateIcons() {
  console.log('Generating icons from original design...')
  console.log('Source:', sourceImage)

  // Generate PNGs for each size (rounded for macOS style)
  for (const size of sizes) {
    const outputPath = join(iconsDir, `${size}x${size}.png`)
    await createRoundedIcon(sourceImage, outputPath, size)
    console.log(`  Created ${size}x${size}.png (rounded)`)
  }

  // Create macOS iconset (rounded)
  const iconsetSizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ]

  for (const { size, name } of iconsetSizes) {
    await createRoundedIcon(sourceImage, join(iconsetDir, name), size)
  }
  console.log('  Created macOS iconset (rounded)')

  // Create main icon.png (512x512) for build folder (rounded)
  await createRoundedIcon(sourceImage, join(buildDir, 'icon.png'), 512)
  console.log('  Created build/icon.png (rounded)')

  // Create favicon (32x32 PNG for web) - square for web
  await sharp(sourceImage)
    .resize(32, 32, { fit: 'contain', background: { r: 250, g: 248, b: 245, alpha: 1 } })
    .png()
    .toFile(join(publicDir, 'favicon.png'))
  console.log('  Created public/favicon.png')

  // Create apple-touch-icon (180x180) - rounded
  await createRoundedIcon(sourceImage, join(publicDir, 'apple-touch-icon.png'), 180)
  console.log('  Created public/apple-touch-icon.png (rounded)')

  // Create favicon-16x16 and favicon-32x32 - square for web
  await sharp(sourceImage)
    .resize(16, 16, { fit: 'contain', background: { r: 250, g: 248, b: 245, alpha: 1 } })
    .png()
    .toFile(join(publicDir, 'favicon-16x16.png'))
  console.log('  Created public/favicon-16x16.png')

  await sharp(sourceImage)
    .resize(32, 32, { fit: 'contain', background: { r: 250, g: 248, b: 245, alpha: 1 } })
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'))
  console.log('  Created public/favicon-32x32.png')

  // Create android icons - rounded
  await createRoundedIcon(sourceImage, join(publicDir, 'android-chrome-192x192.png'), 192)
  console.log('  Created public/android-chrome-192x192.png (rounded)')

  await createRoundedIcon(sourceImage, join(publicDir, 'android-chrome-512x512.png'), 512)
  console.log('  Created public/android-chrome-512x512.png (rounded)')

  console.log('\nIcon generation complete!')
}

generateIcons().catch(console.error)
