/**
 * Patch Electron app name for development mode on macOS
 * This modifies the Electron.app Info.plist to show "VoiceOS" instead of "Electron"
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const electronPath = join(rootDir, 'node_modules/electron/dist/Electron.app/Contents/Info.plist')

if (!existsSync(electronPath)) {
  console.log('Electron.app not found at:', electronPath)
  process.exit(1)
}

console.log('Patching Electron.app Info.plist...')

let plist = readFileSync(electronPath, 'utf8')

// Replace CFBundleName
plist = plist.replace(
  /<key>CFBundleName<\/key>\s*<string>Electron<\/string>/g,
  '<key>CFBundleName</key>\n\t<string>VoiceOS</string>'
)

// Replace CFBundleDisplayName
plist = plist.replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>Electron<\/string>/g,
  '<key>CFBundleDisplayName</key>\n\t<string>VoiceOS</string>'
)

writeFileSync(electronPath, plist)

// Also copy our icon to the Electron.app
const electronIconPath = join(rootDir, 'node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns')
const ourIconPath = join(rootDir, 'build/icon.icns')

if (existsSync(ourIconPath) && existsSync(dirname(electronIconPath))) {
  execSync(`cp "${ourIconPath}" "${electronIconPath}"`)
  console.log('Copied icon to Electron.app')
}

// Touch the app to refresh icon cache
execSync(`touch "${join(rootDir, 'node_modules/electron/dist/Electron.app')}"`)

console.log('Done! Electron.app is now named "VoiceOS"')
console.log('You may need to restart your Mac or run: killall Dock')
