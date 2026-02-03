import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard, shell, powerSaveBlocker } from 'electron'
import * as path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import Store from 'electron-store'

// Next.js server process
let nextServerProcess: ChildProcess | null = null
const NEXT_SERVER_PORT = 3456

// Meeting recording state
let meetingPowerSaveBlockerId: number | null = null
let isMeetingRecording = false

// Type the store with any to work around type resolution issues
const store: { get: (key: string) => unknown; set: (key: string, value: unknown) => void; delete: (key: string) => void } = new Store() as never

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = process.env.NODE_ENV === 'development'
const NEXT_DEV_URL = 'http://localhost:3000'
const NEXT_PROD_URL = `http://localhost:${NEXT_SERVER_PORT}`

/**
 * Start the Next.js standalone server in production mode
 */
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve()
      return
    }

    // In production, the standalone folder is in Resources/standalone
    const resourcesPath = process.resourcesPath || path.join(__dirname, '../..')
    const standalonePath = path.join(resourcesPath, 'standalone/everlast')
    const serverPath = path.join(standalonePath, 'server.js')

    console.log('Starting Next.js standalone server from:', serverPath)

    const nodeRuntimePath = (() => {
      // On macOS packaged apps, spawning the main app executable creates an extra dock tile.
      // Use the helper executable as the Node runtime to avoid that UI artifact.
      if (process.platform === 'darwin' && app.isPackaged) {
        const helperName = `${app.getName()} Helper`
        const helperPath = path.join(
          path.dirname(process.execPath),
          '../Frameworks',
          `${helperName}.app`,
          'Contents/MacOS',
          helperName
        )
        if (existsSync(helperPath)) {
          return helperPath
        }
        console.warn('Helper executable not found, falling back to process.execPath:', helperPath)
      }
      return process.execPath
    })()

    nextServerProcess = spawn(nodeRuntimePath, [serverPath], {
      cwd: standalonePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(NEXT_SERVER_PORT),
        HOSTNAME: 'localhost'
      },
    })

    let started = false
    let settled = false
    let startupTimeout: NodeJS.Timeout | null = null

    const resolveOnce = (): void => {
      if (settled) return
      settled = true
      if (startupTimeout) {
        clearTimeout(startupTimeout)
      }
      resolve()
    }

    const rejectOnce = (error: Error): void => {
      if (settled) return
      settled = true
      if (startupTimeout) {
        clearTimeout(startupTimeout)
      }
      reject(error)
    }

    nextServerProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      console.log('[Next.js]', output)
      if (!started && (output.includes('Ready') || output.includes('started') || output.includes(`${NEXT_SERVER_PORT}`))) {
        started = true
        // Give server a moment to fully initialize
        setTimeout(resolveOnce, 500)
      }
    })

    nextServerProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[Next.js Error]', data.toString())
    })

    nextServerProcess.on('error', (err) => {
      console.error('Failed to start Next.js server:', err)
      rejectOnce(err instanceof Error ? err : new Error(String(err)))
    })

    nextServerProcess.on('exit', (code) => {
      console.log(`Next.js server exited with code ${code}`)
      nextServerProcess = null
      if (!started) {
        rejectOnce(new Error(`Next.js server exited before startup (code: ${code ?? 'unknown'})`))
      }
    })

    // Timeout after 15 seconds
    startupTimeout = setTimeout(() => {
      if (!started) {
        rejectOnce(new Error('Next.js server startup timeout after 15 seconds'))
      }
    }, 15000)
  })
}

/**
 * Stop the Next.js server
 */
function stopNextServer(): void {
  if (nextServerProcess) {
    console.log('Stopping Next.js server...')
    nextServerProcess.kill('SIGTERM')
    nextServerProcess = null
  }
}

function createWindow(): void {
  // Get the correct icon path based on platform
  // __dirname is dist/electron/, so we need to go up 2 levels to reach project root
  const rootDir = path.join(__dirname, '../..')
  const iconPath = process.platform === 'darwin'
    ? path.join(rootDir, 'build/icon.icns')
    : process.platform === 'win32'
    ? path.join(rootDir, 'build/icon.ico')
    : path.join(rootDir, 'build/icon.png')

  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    frame: false,
    backgroundColor: '#FAF8F5',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    icon: iconPath,
    title: 'VoiceOS',
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
    mainWindow.loadURL(NEXT_PROD_URL)
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`Main window loaded: ${isDev ? NEXT_DEV_URL : NEXT_PROD_URL}`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    console.error(`Failed to load URL ${validatedURL} (${errorCode}): ${errorDescription}`)
  })

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
  // Use 16x16 or 32x32 icon for tray (macOS uses template images)
  // __dirname is dist/electron/, so we need to go up 2 levels to reach project root
  const rootDir = path.join(__dirname, '../..')
  const trayIconPath = process.platform === 'darwin'
    ? path.join(rootDir, 'build/icons/16x16.png')
    : path.join(rootDir, 'build/icons/32x32.png')

  let icon = nativeImage.createFromPath(trayIconPath)

  // On macOS, resize to 16x16 for proper tray display and set as template
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 16, height: 16 })
    icon.setTemplateImage(true)
  }

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

// Hotkey configuration interface
interface HotkeyConfig {
  key: string
  modifiers: string[]
  enabled: boolean
}

interface HotkeySettings {
  activate: HotkeyConfig
  toggleMode: HotkeyConfig
  stopRecording: HotkeyConfig
  copyOutput: HotkeyConfig
}

// Default hotkey settings
const DEFAULT_HOTKEYS: HotkeySettings = {
  activate: { key: 'Space', modifiers: ['meta', 'shift'], enabled: true },
  toggleMode: { key: 'M', modifiers: ['meta', 'shift'], enabled: true },
  stopRecording: { key: 'Escape', modifiers: [], enabled: true },
  copyOutput: { key: 'C', modifiers: ['meta'], enabled: true },
}

/**
 * Convert HotkeyConfig to Electron accelerator string
 */
function hotkeyToAccelerator(config: HotkeyConfig): string {
  const parts: string[] = []

  for (const mod of config.modifiers) {
    switch (mod) {
      case 'meta':
        parts.push(process.platform === 'darwin' ? 'Command' : 'Super')
        break
      case 'ctrl':
        parts.push('Control')
        break
      case 'alt':
        parts.push('Alt')
        break
      case 'shift':
        parts.push('Shift')
        break
    }
  }

  // Convert key names to Electron format
  let key = config.key
  if (key === 'Space') key = 'Space'
  else if (key === 'Escape') key = 'Escape'
  else if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join('+')
}

/**
 * Get stored hotkey settings or defaults
 */
function getHotkeySettings(): HotkeySettings {
  const stored = store.get('hotkeys') as HotkeySettings | undefined
  return stored ?? DEFAULT_HOTKEYS
}

/**
 * Register global shortcuts based on stored settings
 */
function registerGlobalShortcuts(): void {
  // Unregister all existing shortcuts first
  globalShortcut.unregisterAll()

  const hotkeys = getHotkeySettings()

  // Main activation shortcut
  if (hotkeys.activate.enabled) {
    const activateAccelerator = hotkeyToAccelerator(hotkeys.activate)
    const registered = globalShortcut.register(activateAccelerator, () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow?.show()
        mainWindow?.focus()
        mainWindow?.webContents.send('hotkey-activate')
      }
    })
    if (!registered) {
      console.warn(`Failed to register activate shortcut: ${activateAccelerator}`)
    }
  }

  // Toggle mode shortcut
  if (hotkeys.toggleMode.enabled) {
    const toggleAccelerator = hotkeyToAccelerator(hotkeys.toggleMode)
    const registered = globalShortcut.register(toggleAccelerator, () => {
      mainWindow?.webContents.send('hotkey-toggle-mode')
    })
    if (!registered) {
      console.warn(`Failed to register toggle mode shortcut: ${toggleAccelerator}`)
    }
  }

  // Additional shortcuts (save-only, query-only) with fixed accelerators
  const saveOnlyShortcut = process.platform === 'darwin' ? 'Command+Shift+Alt+Space' : 'Control+Shift+Alt+Space'
  globalShortcut.register(saveOnlyShortcut, () => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('hotkey-save-only')
  })

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

  // Hotkey management
  ipcMain.handle('hotkeys-update', (_event, hotkeys: HotkeySettings) => {
    store.set('hotkeys', hotkeys)
    registerGlobalShortcuts() // Re-register with new settings
    return true
  })

  ipcMain.handle('hotkeys-get', () => {
    return getHotkeySettings()
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

  // Calendar - Create event in macOS Calendar.app
  ipcMain.handle('calendar-create-event', async (_event, eventData: {
    title: string
    startDate: string
    endDate: string
    notes?: string
    location?: string
    calendarName?: string
  }): Promise<{ success: boolean; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Calendar integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const escapeForAppleScript = (str: string): string => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
      }

      const title = escapeForAppleScript(eventData.title)
      const notes = eventData.notes ? escapeForAppleScript(eventData.notes) : ''
      const location = eventData.location ? escapeForAppleScript(eventData.location) : ''
      const calendarName = eventData.calendarName

      const startDate = new Date(eventData.startDate)
      const endDate = new Date(eventData.endDate)

      // Build calendar selection - use specified name or fall back to first available calendar
      const calendarSelection = calendarName
        ? `set targetCalendar to first calendar whose name is "${escapeForAppleScript(calendarName)}"`
        : `set targetCalendar to first calendar`

      const appleScript = `
tell application "Calendar"
  set startDate to (current date)
  set year of startDate to ${startDate.getFullYear()}
  set month of startDate to ${startDate.getMonth() + 1}
  set day of startDate to ${startDate.getDate()}
  set hours of startDate to ${startDate.getHours()}
  set minutes of startDate to ${startDate.getMinutes()}
  set seconds of startDate to 0

  set endDate to (current date)
  set year of endDate to ${endDate.getFullYear()}
  set month of endDate to ${endDate.getMonth() + 1}
  set day of endDate to ${endDate.getDate()}
  set hours of endDate to ${endDate.getHours()}
  set minutes of endDate to ${endDate.getMinutes()}
  set seconds of endDate to 0

  ${calendarSelection}
  tell targetCalendar
    set newEvent to make new event with properties {summary:"${title}", start date:startDate, end date:endDate${notes ? `, description:"${notes}"` : ''}${location ? `, location:"${location}"` : ''}}
  end tell

  return "success"
end tell
`

      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Calendar create event error:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  // Get available calendars
  ipcMain.handle('calendar-get-calendars', async (): Promise<{ success: boolean; calendars?: string[]; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Calendar integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const appleScript = `
tell application "Calendar"
  set calNames to {}
  repeat with cal in calendars
    set end of calNames to name of cal
  end repeat
  return calNames
end tell
`
      const { stdout } = await execAsync(`osascript -e '${appleScript}'`)
      const calendars = stdout.trim().split(', ').filter(Boolean)
      return { success: true, calendars }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  })

  // ==================== APPLE REMINDERS ====================

  // Create reminder in Apple Reminders
  ipcMain.handle('reminders-create-task', async (_event, taskData: {
    title: string
    notes?: string
    dueDate?: string
    priority?: 'low' | 'medium' | 'high'
    listName?: string
  }): Promise<{ success: boolean; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Reminders integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const escapeForAppleScript = (str: string): string => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
      }

      const title = escapeForAppleScript(taskData.title)
      const notes = taskData.notes ? escapeForAppleScript(taskData.notes) : ''
      const listName = taskData.listName

      // Map priority: low=9, medium=5, high=1 (Apple's priority scale is 1-9, 1=highest)
      const priorityMap = { low: 9, medium: 5, high: 1 }
      const priority = taskData.priority ? priorityMap[taskData.priority] : 0

      // Build list selection
      const listSelection = listName
        ? `set targetList to first list whose name is "${escapeForAppleScript(listName)}"`
        : `set targetList to default list`

      // Build due date if provided
      let dueDateScript = ''
      if (taskData.dueDate) {
        const dueDate = new Date(taskData.dueDate)
        dueDateScript = `
  set dueDate to (current date)
  set year of dueDate to ${dueDate.getFullYear()}
  set month of dueDate to ${dueDate.getMonth() + 1}
  set day of dueDate to ${dueDate.getDate()}
  set hours of dueDate to ${dueDate.getHours()}
  set minutes of dueDate to ${dueDate.getMinutes()}
  set seconds of dueDate to 0`
      }

      const appleScript = `
tell application "Reminders"
  ${listSelection}
  ${dueDateScript}
  tell targetList
    set newReminder to make new reminder with properties {name:"${title}"${notes ? `, body:"${notes}"` : ''}${priority > 0 ? `, priority:${priority}` : ''}${taskData.dueDate ? ', due date:dueDate' : ''}}
  end tell
  return "success"
end tell
`

      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Reminders create task error:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  // Create multiple reminders at once
  ipcMain.handle('reminders-create-tasks', async (_event, tasks: Array<{
    title: string
    notes?: string
    dueDate?: string
    priority?: 'low' | 'medium' | 'high'
  }>, listName?: string): Promise<{ success: boolean; created: number; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, created: 0, error: 'Reminders integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const escapeForAppleScript = (str: string): string => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
      }

      const listSelection = listName
        ? `set targetList to first list whose name is "${escapeForAppleScript(listName)}"`
        : `set targetList to default list`

      const priorityMap = { low: 9, medium: 5, high: 1 }

      // Build reminder creation statements
      const reminderStatements = tasks.map(task => {
        const title = escapeForAppleScript(task.title)
        const notes = task.notes ? escapeForAppleScript(task.notes) : ''
        const priority = task.priority ? priorityMap[task.priority] : 0
        return `make new reminder with properties {name:"${title}"${notes ? `, body:"${notes}"` : ''}${priority > 0 ? `, priority:${priority}` : ''}}`
      }).join('\n      ')

      const appleScript = `
tell application "Reminders"
  ${listSelection}
  tell targetList
      ${reminderStatements}
  end tell
  return "success"
end tell
`

      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`)
      return { success: true, created: tasks.length }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Reminders create tasks error:', errorMessage)
      return { success: false, created: 0, error: errorMessage }
    }
  })

  // Get available reminder lists
  ipcMain.handle('reminders-get-lists', async (): Promise<{ success: boolean; lists?: string[]; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Reminders integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const appleScript = `
tell application "Reminders"
  set listNames to {}
  repeat with reminderList in lists
    set end of listNames to name of reminderList
  end repeat
  return listNames
end tell
`
      const { stdout } = await execAsync(`osascript -e '${appleScript}'`)
      const lists = stdout.trim().split(', ').filter(Boolean)
      return { success: true, lists }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  })

  // ==================== APPLE NOTES ====================

  // Create note in Apple Notes
  ipcMain.handle('notes-create-note', async (_event, noteData: {
    title: string
    body: string
    folderName?: string
  }): Promise<{ success: boolean; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Notes integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const escapeForAppleScript = (str: string): string => {
        return str
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
      }

      const title = escapeForAppleScript(noteData.title)
      const body = escapeForAppleScript(noteData.body)
      const folderName = noteData.folderName ? escapeForAppleScript(noteData.folderName) : null

      // Build folder selection - use specified name or fall back to default folder
      const folderSelection = folderName
        ? `set targetFolder to first folder whose name is "${folderName}"`
        : `set targetFolder to default folder`

      // Apple Notes uses HTML for the body content
      const htmlBody = `<h1>${title}</h1><br>${body.replace(/\\n/g, '<br>')}`

      const appleScript = `
tell application "Notes"
  activate
  tell default account
    ${folderSelection}
    tell targetFolder
      make new note with properties {name:"${title}", body:"${htmlBody}"}
    end tell
  end tell
  return "success"
end tell
`

      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Notes create note error:', errorMessage)
      return { success: false, error: errorMessage }
    }
  })

  // Get available notes folders
  ipcMain.handle('notes-get-folders', async (): Promise<{ success: boolean; folders?: string[]; error?: string }> => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Notes integration only available on macOS' }
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const appleScript = `
tell application "Notes"
  tell default account
    set folderNames to {}
    repeat with notesFolder in folders
      set end of folderNames to name of notesFolder
    end repeat
    return folderNames
  end tell
end tell
`
      const { stdout } = await execAsync(`osascript -e '${appleScript}'`)
      const folders = stdout.trim().split(', ').filter(Boolean)
      return { success: true, folders }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  })

  // ==================== MICROSOFT TO DO ====================

  // Open Microsoft To Do app (native)
  ipcMain.handle('microsoft-todo-open-app', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      if (process.platform === 'darwin') {
        // Try to open the app on macOS
        try {
          await execAsync('open -a "Microsoft To Do"')
          return { success: true }
        } catch {
          // App might not be installed, try alternative name
          try {
            await execAsync('open -a "To Do"')
            return { success: true }
          } catch {
            return { success: false, error: 'Microsoft To Do App nicht gefunden' }
          }
        }
      } else if (process.platform === 'win32') {
        // On Windows, use start command with URL scheme
        try {
          await execAsync('start ms-todo:')
          return { success: true }
        } catch {
          return { success: false, error: 'Microsoft To Do App nicht gefunden' }
        }
      }

      return { success: false, error: 'Plattform nicht unterstützt' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' }
    }
  })

  // Check if Microsoft To Do app is installed
  ipcMain.handle('microsoft-todo-check-installed', async (): Promise<boolean> => {
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      if (process.platform === 'darwin') {
        try {
          await execAsync('mdfind "kMDItemCFBundleIdentifier == com.microsoft.to-do-mac"')
          return true
        } catch {
          return false
        }
      }
      return false
    } catch {
      return false
    }
  })
}

// Prevent multiple instances - MUST be checked BEFORE app.whenReady()
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

  // App lifecycle - only runs if we got the lock
  app.whenReady().then(async () => {
    // Set app name
    app.setName('VoiceOS')

    // Set dock icon on macOS
    if (process.platform === 'darwin' && app.dock) {
      const rootDir = path.join(__dirname, '../..')
      const dockIconPath = path.join(rootDir, 'build/icon.png')
      const dockIcon = nativeImage.createFromPath(dockIconPath)
      if (!dockIcon.isEmpty()) {
        app.dock.setIcon(dockIcon)
      }
    }

    // Start Next.js server in production
    try {
      await startNextServer()
    } catch (err) {
      console.error('Failed to start Next.js server:', err)
      app.quit()
      return
    }

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
    stopNextServer()
  })
}
