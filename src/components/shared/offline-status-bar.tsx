'use client'

import { useOfflineSync } from '@/lib/hooks/use-offline-sync'
import { Wifi, WifiOff, RefreshCw, CloudUpload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OfflineStatusBar() {
  const { isOnline, pendingCount, syncing, manualSync } = useOfflineSync()

  if (isOnline && pendingCount === 0) return null

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 text-xs font-medium',
      isOnline ? 'bg-amber-50 text-amber-700 border-b border-amber-100' : 'bg-red-50 text-red-700 border-b border-red-100'
    )}>
      {isOnline
        ? <CloudUpload className="w-3.5 h-3.5 flex-shrink-0" />
        : <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      }
      <span className="flex-1">
        {isOnline
          ? `${pendingCount} transaksi offline menunggu sinkronisasi`
          : 'Tidak ada koneksi internet — mode offline aktif'
        }
      </span>
      {isOnline && pendingCount > 0 && (
        <Button size="sm" variant="ghost" onClick={manualSync} disabled={syncing} className="h-5 px-2 text-xs text-amber-700">
          <RefreshCw className={cn('w-3 h-3', syncing && 'animate-spin')} />
          {syncing ? 'Syncing…' : 'Sync sekarang'}
        </Button>
      )}
    </div>
  )
}
