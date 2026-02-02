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
 * Crop the center of the image to remove excess whitespace
 * The original has too much padding - we extract the center portion
 */
async function getCroppedSource(inputPath) {
  const metadata = await sharp(inputPath).metadata()
  const { width, height } = metadata

  // Crop to remove ~25% padding on each side (extract center 50% -> 60%)
  // This makes the VO much larger in the final icon
  const cropSize = Math.min(width, height) * 0.55
  const left = Math.floor((width - cropSize) / 2)
  const top = Math.floor((height - cropSize) / 2)

  return sharp(inputPath)
    .extract({
      left,
      top,
      width: Math.floor(cropSize),
      height: Math.floor(cropSize)
    })
    .toBuffer()
}

/**
 * Create icon with rounded corners (macOS style)
 */
async function createRoundedIcon(inputBuffer, outputPath, size) {
  const roundedCorners = Buffer.from(
    `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.18}" ry="${size * 0.18}"/></svg>`
  )

  await sharp(inputBuffer)
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
  console.log('Cropping to remove excess whitespace...')

  // Get cropped source
  const croppedBuffer = await getCroppedSource(sourceImage)

  // Generate PNGs for each size (rounded for macOS style)
  for (const size of sizes) {
    const outputPath = join(iconsDir, `${size}x${size}.png`)
    await createRoundedIcon(croppedBuffer, outputPath, size)
    console.log(`  Created ${size}x${size}.png`)
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
    await createRoundedIcon(croppedBuffer, join(iconsetDir, name), size)
  }
  console.log('  Created macOS iconset')

  // Create main icon.png (512x512) for build folder
  await createRoundedIcon(croppedBuffer, join(buildDir, 'icon.png'), 512)
  console.log('  Created build/icon.png')

  // Create favicon (32x32 PNG for web)
  await sharp(croppedBuffer)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(join(publicDir, 'favicon.png'))
  console.log('  Created public/favicon.png')

  // Create apple-touch-icon (180x180) - rounded
  await createRoundedIcon(croppedBuffer, join(publicDir, 'apple-touch-icon.png'), 180)
  console.log('  Created public/apple-touch-icon.png')

  // Create favicon-16x16 and favicon-32x32
  await sharp(croppedBuffer)
    .resize(16, 16, { fit: 'cover' })
    .png()
    .toFile(join(publicDir, 'favicon-16x16.png'))
  console.log('  Created public/favicon-16x16.png')

  await sharp(croppedBuffer)
    .resize(32, 32, { fit: 'cover' })
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'))
  console.log('  Created public/favicon-32x32.png')

  // Create android icons - rounded
  await createRoundedIcon(croppedBuffer, join(publicDir, 'android-chrome-192x192.png'), 192)
  console.log('  Created public/android-chrome-192x192.png')

  await createRoundedIcon(croppedBuffer, join(publicDir, 'android-chrome-512x512.png'), 512)
  console.log('  Created public/android-chrome-512x512.png')

  console.log('\nIcon generation complete!')
  console.log('\nTo create .icns file for macOS, run:')
  console.log('  iconutil -c icns build/icon.iconset -o build/icon.icns')
}

generateIcons().catch(console.error)
