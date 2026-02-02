import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, shell, powerSaveBlocker } from 'electron'
import * as path from 'path'
import Store from 'electron-store'

// Meeting recording state
let meetingPowerSaveBlockerId: number | null = null
let isMeetingRecording = false

// Type the store with any to work around type resolution issues
const store: { get: (key: string) => unknown; set: (key: string, value: unknown) => void; delete: (key: string) => void } = new Store() as never

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = process.env.NODE_ENV === 'development'
const NEXT_DEV_URL = 'http://localhost:3000'

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    backgroundColor: '#0a0a0b',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL(NEXT_DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window-blur')
  })

  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window-focus')
  })
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../public/icons/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)

  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })
}

function updateTrayMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show VoiceOS', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Private Mode', type: 'radio', checked: true },
    { label: 'Work Mode', type: 'radio' },
    { type: 'separator' },
    ...(isMeetingRecording
      ? [
          { label: '🔴 Meeting läuft...', enabled: false },
          { label: 'Meeting beenden', click: () => mainWindow?.webContents.send('meeting-stop-requested') },
          { type: 'separator' as const },
        ]
      : []),
    { label: 'Settings', click: () => mainWindow?.webContents.send('open-settings') },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      if (isMeetingRecording) {
        // Warn user about active meeting
        mainWindow?.show()
        mainWindow?.webContents.send('meeting-quit-warning')
      } else {
        app.quit()
      }
    }},
  ])

  tray.setToolTip(isMeetingRecording ? 'VoiceOS - Meeting läuft' : 'VoiceOS')
  tray.setContextMenu(contextMenu)
}

function registerGlobalShortcuts(): void {
  // Main activation: Cmd+Shift+Space (Mac) / Ctrl+Shift+Space (Windows/Linux)
  const activateShortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space'

  globalShortcut.register(activateShortcut, () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
      mainWindow?.webContents.send('hotkey-activate')
    }
  })

  // Save only: Cmd+Shift+Alt+Space
  const saveOnlyShortcut = process.platform === 'darwin' ? 'Command+Shift+Alt+Space' : 'Control+Shift+Alt+Space'

  globalShortcut.register(saveOnlyShortcut, () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('hotkey-save-only')
  })

  // Query only: Cmd+Shift+Ctrl+Space (Mac) / Ctrl+Shift+Win+Space won't work, use different combo
  const queryOnlyShortcut = process.platform === 'darwin' ? 'Command+Control+Space' : 'Control+Alt+Space'

  globalShortcut.register(queryOnlyShortcut, () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('hotkey-query-only')
  })
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Window controls
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => mainWindow?.hide())
  ipcMain.on('window-toggle-always-on-top', (_event, value: boolean) => {
    mainWindow?.setAlwaysOnTop(value)
  })

  // Storage
  ipcMain.handle('store-get', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
    store.set(key, value)
    return true
  })

  ipcMain.handle('store-delete', (_event, key: string) => {
    store.delete(key)
    return true
  })

  // Clipboard
  ipcMain.handle('clipboard-write', (_event, text: string) => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle('clipboard-read', () => {
    return clipboard.readText()
  })

  // App info
  ipcMain.handle('get-app-version', () => app.getVersion())
  ipcMain.handle('get-platform', () => process.platform)

  // Knowledge Base persistence
  ipcMain.handle('knowledge-get-all', () => {
    const entries = store.get('knowledge-entries')
    return entries || []
  })

  ipcMain.handle('knowledge-save-all', (_event, entries: unknown[]) => {
    store.set('knowledge-entries', entries)
    return true
  })

  ipcMain.handle('knowledge-add', (_event, entry: unknown) => {
    const existing = store.get('knowledge-entries')
    const entries = (existing || []) as unknown[]
    entries.push(entry)
    store.set('knowledge-entries', entries)
    return true
  })

  ipcMain.handle('knowledge-update', (_event, id: string, updates: unknown) => {
    const existing = store.get('knowledge-entries')
    const entries = (existing || []) as Array<{ id: string }>
    const index = entries.findIndex(e => e.id === id)
    if (index !== -1) {
      entries[index] = { ...entries[index], ...updates as object }
      store.set('knowledge-entries', entries)
      return true
    }
    return false
  })

  ipcMain.handle('knowledge-remove', (_event, id: string) => {
    const existing = store.get('knowledge-entries')
    const entries = (existing || []) as Array<{ id: string }>
    const filtered = entries.filter(e => e.id !== id)
    store.set('knowledge-entries', filtered)
    return true
  })

  ipcMain.handle('knowledge-clear', () => {
    store.set('knowledge-entries', [])
    return true
  })

  // Shell - open external URLs
  ipcMain.handle('shell-open-external', async (_event, url: string) => {
    await shell.openExternal(url)
    return true
  })

  // Meeting Recording - Power Save Blocker
  ipcMain.handle('meeting-start-power-block', () => {
    if (meetingPowerSaveBlockerId !== null) {
      return meetingPowerSaveBlockerId
    }
    meetingPowerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    isMeetingRecording = true
    updateTrayMenu()
    return meetingPowerSaveBlockerId
  })

  ipcMain.handle('meeting-stop-power-block', () => {
    if (meetingPowerSaveBlockerId !== null) {
      powerSaveBlocker.stop(meetingPowerSaveBlockerId)
      meetingPowerSaveBlockerId = null
    }
    isMeetingRecording = false
    updateTrayMenu()
    return true
  })

  ipcMain.handle('meeting-is-power-block-active', () => {
    return meetingPowerSaveBlockerId !== null && powerSaveBlocker.isStarted(meetingPowerSaveBlockerId)
  })

  // Meeting status updates
  ipcMain.on('meeting-status-changed', (_event, status: string) => {
    isMeetingRecording = status === 'recording' || status === 'paused'
    updateTrayMenu()
  })

  // Meeting data persistence
  ipcMain.handle('meeting-save', (_event, meeting: unknown) => {
    const history = (store.get('meeting-history') || []) as unknown[]
    history.unshift(meeting)
    // Keep only last 50 meetings
    store.set('meeting-history', history.slice(0, 50))
    return true
  })

  ipcMain.handle('meeting-get-history', () => {
    return store.get('meeting-history') || []
  })

  ipcMain.handle('meeting-delete', (_event, id: string) => {
    const history = (store.get('meeting-history') || []) as Array<{ id: string }>
    const filtered = history.filter(m => m.id !== id)
    store.set('meeting-history', filtered)
    return true
  })

  ipcMain.handle('meeting-clear-history', () => {
    store.set('meeting-history', [])
    return true
  })
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  createTray()
  registerGlobalShortcuts()
  setupIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
