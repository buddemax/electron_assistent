'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import {
  serializeEntry,
  deserializeEntries,
  type SerializedKnowledgeEntry,
} from './persistence'
import type { KnowledgeEntry } from '@/types/knowledge'

/**
 * Hook that syncs the knowledge store with Electron's persistent storage
 * - Loads entries on mount
 * - Saves entries when they change
 */
export function useKnowledgePersistence() {
  const { entries, setEntries, addEntry, updateEntry, removeEntry } = useKnowledgeStore()
  const isInitializedRef = useRef(false)
  const isLoadingRef = useRef(false)

  // Load entries from Electron store on mount
  useEffect(() => {
    const loadEntries = async () => {
      if (isInitializedRef.current || isLoadingRef.current) return
      if (typeof window === 'undefined' || !window.electronAPI?.knowledge) return

      isLoadingRef.current = true

      try {
        const serialized = await window.electronAPI.knowledge.getAll<SerializedKnowledgeEntry>()
        if (serialized && serialized.length > 0) {
          const deserialized = deserializeEntries(serialized)
          setEntries(deserialized)
        }
        isInitializedRef.current = true
      } catch (error) {
        console.error('Failed to load knowledge entries:', error)
      } finally {
        isLoadingRef.current = false
      }
    }

    loadEntries()
  }, [setEntries])

  // Persist a single new entry
  const persistAddEntry = useCallback(async (entry: KnowledgeEntry) => {
    addEntry(entry)

    if (typeof window !== 'undefined' && window.electronAPI?.knowledge) {
      try {
        const serialized = serializeEntry(entry)
        await window.electronAPI.knowledge.add(serialized)
      } catch (error) {
        console.error('Failed to persist new entry:', error)
      }
    }
  }, [addEntry])

  // Persist entry update
  const persistUpdateEntry = useCallback(async (id: string, updates: Partial<KnowledgeEntry>) => {
    updateEntry(id, updates)

    if (typeof window !== 'undefined' && window.electronAPI?.knowledge) {
      try {
        // Serialize date fields if present
        const serializedUpdates: Record<string, unknown> = { ...updates }
        if (updates.createdAt) {
          serializedUpdates.createdAt = updates.createdAt.toISOString()
        }
        if (updates.updatedAt) {
          serializedUpdates.updatedAt = updates.updatedAt.toISOString()
        }
        if (updates.metadata?.lastAccessedAt) {
          serializedUpdates.metadata = {
            ...updates.metadata,
            lastAccessedAt: updates.metadata.lastAccessedAt.toISOString(),
          }
        }
        await window.electronAPI.knowledge.update(id, serializedUpdates)
      } catch (error) {
        console.error('Failed to persist entry update:', error)
      }
    }
  }, [updateEntry])

  // Persist entry removal
  const persistRemoveEntry = useCallback(async (id: string) => {
    removeEntry(id)

    if (typeof window !== 'undefined' && window.electronAPI?.knowledge) {
      try {
        await window.electronAPI.knowledge.remove(id)
      } catch (error) {
        console.error('Failed to persist entry removal:', error)
      }
    }
  }, [removeEntry])

  // Clear all entries
  const persistClearAll = useCallback(async () => {
    setEntries([])

    if (typeof window !== 'undefined' && window.electronAPI?.knowledge) {
      try {
        await window.electronAPI.knowledge.clear()
      } catch (error) {
        console.error('Failed to clear knowledge entries:', error)
      }
    }
  }, [setEntries])

  return {
    entries,
    isInitialized: isInitializedRef.current,
    addEntry: persistAddEntry,
    updateEntry: persistUpdateEntry,
    removeEntry: persistRemoveEntry,
    clearAll: persistClearAll,
  }
}
