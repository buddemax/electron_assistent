'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface WaveformProps {
  data: Float32Array | null
  isRecording: boolean
  barCount?: number
  className?: string
}

export function Waveform({
  data,
  isRecording,
  barCount = 32,
  className = '',
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    const barWidth = rect.width / barCount
    const gap = 2
    const maxHeight = rect.height * 0.8
    const minHeight = 4

    // Calculate bar heights from audio data
    const heights: number[] = []
    if (data && data.length > 0 && isRecording) {
      const samplesPerBar = Math.floor(data.length / barCount)
      for (let i = 0; i < barCount; i++) {
        let sum = 0
        for (let j = 0; j < samplesPerBar; j++) {
          const index = i * samplesPerBar + j
          if (index < data.length) {
            sum += Math.abs(data[index])
          }
        }
        const avg = sum / samplesPerBar
        const height = Math.max(minHeight, avg * maxHeight * 10)
        heights.push(Math.min(height, maxHeight))
      }
    } else {
      // Idle state - minimal bars
      for (let i = 0; i < barCount; i++) {
        heights.push(minHeight)
      }
    }

    // Draw bars
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent')
      .trim()

    ctx.fillStyle = isRecording ? accentColor || '#6366f1' : '#48484a'

    for (let i = 0; i < barCount; i++) {
      const x = i * barWidth + gap / 2
      const height = heights[i]
      const y = (rect.height - height) / 2

      // Rounded rect
      const radius = 2
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth - gap, height, radius)
      ctx.fill()
    }
  }, [data, isRecording, barCount])

  return (
    <motion.div
      className={`w-full ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-12"
        style={{ width: '100%', height: '48px' }}
      />
    </motion.div>
  )
}

// Simplified bar waveform for smaller spaces
interface MiniWaveformProps {
  isActive: boolean
  barCount?: number
}

export function MiniWaveform({ isActive, barCount = 5 }: MiniWaveformProps) {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full ${isActive ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'}`}
          animate={
            isActive
              ? {
                  height: ['8px', '16px', '8px'],
                }
              : { height: '4px' }
          }
          transition={
            isActive
              ? {
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  )
}
