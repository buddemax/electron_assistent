import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  window: {
    minimize: () => void
    close: () => void
    setAlwaysOnTop: (value: boolean) => void
  }
  storage: {
    get: <T>(key: string) => Promise<T | null>
    set: <T>(key: string, value: T) => Promise<boolean>
    delete: (key: string) => Promise<boolean>
  }
  clipboard: {
    write: (text: string) => Promise<boolean>
    read: () => Promise<string>
  }
  shell: {
    openExternal: (url: string) => Promise<boolean>
  }
  knowledge: {
    getAll: <T>() => Promise<T[]>
    saveAll: <T>(entries: T[]) => Promise<boolean>
    add: <T>(entry: T) => Promise<boolean>
    update: <T>(id: string, updates: Partial<T>) => Promise<boolean>
    remove: (id: string) => Promise<boolean>
    clear: () => Promise<boolean>
  }
  meeting: {
    startPowerBlock: () => Promise<number>
    stopPowerBlock: () => Promise<boolean>
    isPowerBlockActive: () => Promise<boolean>
    updateStatus: (status: string) => void
    save: <T>(meeting: T) => Promise<boolean>
    getHistory: <T>() => Promise<T[]>
    delete: (id: string) => Promise<boolean>
    clearHistory: () => Promise<boolean>
  }
  app: {
    getVersion: () => Promise<string>
    getPlatform: () => Promise<NodeJS.Platform>
  }
  on: {
    windowBlur: (callback: () => void) => () => void
    windowFocus: (callback: () => void) => () => void
    hotkeyActivate: (callback: () => void) => () => void
    hotkeySaveOnly: (callback: () => void) => () => void
    hotkeyQueryOnly: (callback: () => void) => () => void
    openSettings: (callback: () => void) => () => void
    meetingStopRequested: (callback: () => void) => () => void
    meetingQuitWarning: (callback: () => void) => () => void
  }
}

const electronAPI: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    setAlwaysOnTop: (value: boolean) => ipcRenderer.send('window-toggle-always-on-top', value),
  },
  storage: {
    get: <T>(key: string) => ipcRenderer.invoke('store-get', key) as Promise<T | null>,
    set: <T>(key: string, value: T) => ipcRenderer.invoke('store-set', key, value) as Promise<boolean>,
    delete: (key: string) => ipcRenderer.invoke('store-delete', key) as Promise<boolean>,
  },
  clipboard: {
    write: (text: string) => ipcRenderer.invoke('clipboard-write', text) as Promise<boolean>,
    read: () => ipcRenderer.invoke('clipboard-read') as Promise<string>,
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell-open-external', url) as Promise<boolean>,
  },
  knowledge: {
    getAll: <T>() => ipcRenderer.invoke('knowledge-get-all') as Promise<T[]>,
    saveAll: <T>(entries: T[]) => ipcRenderer.invoke('knowledge-save-all', entries) as Promise<boolean>,
    add: <T>(entry: T) => ipcRenderer.invoke('knowledge-add', entry) as Promise<boolean>,
    update: <T>(id: string, updates: Partial<T>) => ipcRenderer.invoke('knowledge-update', id, updates) as Promise<boolean>,
    remove: (id: string) => ipcRenderer.invoke('knowledge-remove', id) as Promise<boolean>,
    clear: () => ipcRenderer.invoke('knowledge-clear') as Promise<boolean>,
  },
  meeting: {
    startPowerBlock: () => ipcRenderer.invoke('meeting-start-power-block') as Promise<number>,
    stopPowerBlock: () => ipcRenderer.invoke('meeting-stop-power-block') as Promise<boolean>,
    isPowerBlockActive: () => ipcRenderer.invoke('meeting-is-power-block-active') as Promise<boolean>,
    updateStatus: (status: string) => ipcRenderer.send('meeting-status-changed', status),
    save: <T>(meeting: T) => ipcRenderer.invoke('meeting-save', meeting) as Promise<boolean>,
    getHistory: <T>() => ipcRenderer.invoke('meeting-get-history') as Promise<T[]>,
    delete: (id: string) => ipcRenderer.invoke('meeting-delete', id) as Promise<boolean>,
    clearHistory: () => ipcRenderer.invoke('meeting-clear-history') as Promise<boolean>,
  },
  app: {
    getVersion: () => ipcRenderer.invoke('get-app-version') as Promise<string>,
    getPlatform: () => ipcRenderer.invoke('get-platform') as Promise<NodeJS.Platform>,
  },
  on: {
    windowBlur: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('window-blur', handler)
      return () => ipcRenderer.removeListener('window-blur', handler)
    },
    windowFocus: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('window-focus', handler)
      return () => ipcRenderer.removeListener('window-focus', handler)
    },
    hotkeyActivate: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('hotkey-activate', handler)
      return () => ipcRenderer.removeListener('hotkey-activate', handler)
    },
    hotkeySaveOnly: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('hotkey-save-only', handler)
      return () => ipcRenderer.removeListener('hotkey-save-only', handler)
    },
    hotkeyQueryOnly: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('hotkey-query-only', handler)
      return () => ipcRenderer.removeListener('hotkey-query-only', handler)
    },
    openSettings: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('open-settings', handler)
      return () => ipcRenderer.removeListener('open-settings', handler)
    },
    meetingStopRequested: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('meeting-stop-requested', handler)
      return () => ipcRenderer.removeListener('meeting-stop-requested', handler)
    },
    meetingQuitWarning: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('meeting-quit-warning', handler)
      return () => ipcRenderer.removeListener('meeting-quit-warning', handler)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
