/**
 * Microsoft To Do Integration
 *
 * Opens Microsoft To Do native app, falls back to web version
 */

export interface TodoTask {
  title: string
  notes?: string
  dueDate?: string
  priority?: 'low' | 'medium' | 'high'
}

// Web version URL
const WEB_TODO_URL = 'https://to-do.microsoft.com/tasks'

/**
 * Open Microsoft To Do with tasks
 * Tries native app first, falls back to web version
 * Copies tasks to clipboard for easy pasting
 */
export async function openWithTasks(tasks: TodoTask[]): Promise<{ success: boolean; opened: number; usedWeb: boolean }> {
  if (!window.electronAPI) {
    return { success: false, opened: 0, usedWeb: false }
  }

  // Copy tasks to clipboard first
  if (window.electronAPI.clipboard?.write) {
    const taskList = tasks.map(t => `- ${t.title}`).join('\n')
    await window.electronAPI.clipboard.write(taskList)
  }

  // Try to open native app
  if (window.electronAPI.microsoftTodo?.openApp) {
    const result = await window.electronAPI.microsoftTodo.openApp()
    if (result.success) {
      return { success: true, opened: tasks.length, usedWeb: false }
    }
  }

  // Fallback to web version
  if (window.electronAPI.shell?.openExternal) {
    try {
      await window.electronAPI.shell.openExternal(WEB_TODO_URL)
      return { success: true, opened: tasks.length, usedWeb: true }
    } catch {
      return { success: false, opened: 0, usedWeb: false }
    }
  }

  return { success: false, opened: 0, usedWeb: false }
}

/**
 * Just open Microsoft To Do app
 */
export async function openApp(): Promise<{ success: boolean; usedWeb: boolean }> {
  if (!window.electronAPI) {
    return { success: false, usedWeb: false }
  }

  // Try native app first
  if (window.electronAPI.microsoftTodo?.openApp) {
    const result = await window.electronAPI.microsoftTodo.openApp()
    if (result.success) {
      return { success: true, usedWeb: false }
    }
  }

  // Fallback to web
  if (window.electronAPI.shell?.openExternal) {
    await window.electronAPI.shell.openExternal(WEB_TODO_URL)
    return { success: true, usedWeb: true }
  }

  return { success: false, usedWeb: false }
}

/**
 * Check if Microsoft To Do native app is installed
 */
export async function isInstalled(): Promise<boolean> {
  if (window.electronAPI?.microsoftTodo?.checkInstalled) {
    return window.electronAPI.microsoftTodo.checkInstalled()
  }
  return false
}
