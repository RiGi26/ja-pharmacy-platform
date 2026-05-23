'use client'

import { useEffect, useState, useCallback } from 'react'
import { syncPendingTransactions, getPendingCount } from '@/lib/offline/sync'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {}
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const onOnline = async () => {
      setIsOnline(true)
      const count = await getPendingCount()
      if (count > 0) {
        setSyncing(true)
        await syncPendingTransactions()
        await refreshPendingCount()
        setSyncing(false)
      }
    }

    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    refreshPendingCount()

    // Poll for pending changes every 30s when online
    const interval = setInterval(() => {
      if (navigator.onLine) refreshPendingCount()
    }, 30_000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [refreshPendingCount])

  const manualSync = useCallback(async () => {
    if (!isOnline) return
    setSyncing(true)
    await syncPendingTransactions()
    await refreshPendingCount()
    setSyncing(false)
  }, [isOnline, refreshPendingCount])

  return { isOnline, pendingCount, syncing, manualSync, refreshPendingCount }
}
