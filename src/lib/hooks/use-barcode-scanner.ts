'use client'

import { useEffect, useRef } from 'react'

interface Options {
  onScan: (barcode: string) => void
  minLength?: number
  bufferMs?: number
  enabled?: boolean
}

export function useBarcodeScanner({ onScan, minLength = 5, bufferMs = 100, enabled = true }: Options) {
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when focus is inside a text input (unless it's our hidden scanner input)
      const target = e.target as HTMLElement
      const isTypingField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.classList.contains('barcode-scanner-target')

      if (isTypingField) return

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim()
        bufferRef.current = ''
        if (timerRef.current) clearTimeout(timerRef.current)
        if (code.length >= minLength) onScan(code)
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          bufferRef.current = ''
        }, bufferMs)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onScan, minLength, bufferMs, enabled])
}
