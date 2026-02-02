'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoiceInputFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  multiline?: boolean
  className?: string
}

export function VoiceInputField({
  value,
  onChange,
  placeholder = 'Text eingeben oder diktieren...',
  label,
  multiline = false,
  className = '',
}: VoiceInputFieldProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsProcessing(true)
        stream.getTracks().forEach((track) => track.stop())

        try {
          const blob = new Blob(chunksRef.current, { type: mimeType })

          // Send to transcription API
          const formData = new FormData()
          formData.append('audio', blob, 'voice-input.webm')
          formData.append('language', 'de')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data?.transcription?.text) {
              const transcribedText = data.data.transcription.text.trim()
              // Append to existing value with space if needed
              const newValue = value
                ? `${value} ${transcribedText}`
                : transcribedText
              onChange(newValue)
            }
          }
        } catch (error) {
          console.error('Transcription error:', error)
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }, [value, onChange])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  const InputComponent = multiline ? 'textarea' : 'input'

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}

      <div className="relative">
        <InputComponent
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-3 py-2 pr-12
            bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600
            rounded-lg text-sm text-neutral-900 dark:text-white
            placeholder:text-neutral-400 dark:placeholder:text-neutral-500
            focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500
            transition-colors
            ${multiline ? 'min-h-[100px] resize-y' : ''}
          `}
        />

        {/* Voice input button */}
        <button
          type="button"
          onClick={toggleRecording}
          disabled={isProcessing}
          className={`
            absolute right-2 top-1/2 -translate-y-1/2
            w-8 h-8 rounded-full flex items-center justify-center
            transition-all
            ${
              isRecording
                ? 'bg-red-500 text-white'
                : isProcessing
                  ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400'
            }
          `}
          title={isRecording ? 'Aufnahme beenden' : 'Spracheingabe starten'}
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              />
            ) : isRecording ? (
              <motion.div
                key="recording"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <MicrophoneIcon className="w-4 h-4" />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <MicrophoneIcon className="w-4 h-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute -bottom-6 left-0 flex items-center gap-1.5 text-xs text-red-500"
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-red-500"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              Aufnahme läuft...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  )
}
