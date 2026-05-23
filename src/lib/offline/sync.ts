import { offlineDb, OfflineTransaction } from './db'

export async function syncPendingTransactions(): Promise<{ synced: number; errors: number }> {
  const pending = await offlineDb.transactions
    .where('sync_status').equals('PENDING')
    .toArray()

  let synced = 0
  let errors = 0

  for (const tx of pending) {
    try {
      const res = await fetch('/api/pos/sync-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      })

      if (res.ok) {
        const { id: serverId } = await res.json()
        await offlineDb.transactions.update(tx.id, {
          sync_status: 'SYNCED',
          server_id: serverId,
        })
        synced++
      } else if (res.status === 409) {
        await offlineDb.transactions.update(tx.id, { sync_status: 'CONFLICT' })
        errors++
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
        await offlineDb.transactions.update(tx.id, { sync_status: 'ERROR', sync_error: error })
        errors++
      }
    } catch {
      await offlineDb.transactions.update(tx.id, { sync_status: 'ERROR', sync_error: 'Network error' })
      errors++
    }
  }

  return { synced, errors }
}

export async function cacheMedicinesForOffline(tenantId: string): Promise<void> {
  const res = await fetch(`/api/pos/medicines-cache?tenantId=${tenantId}`)
  if (!res.ok) return

  const medicines = await res.json()
  const cachedAt = new Date().toISOString()

  await offlineDb.medicines.where('tenant_id').equals(tenantId).delete()
  await offlineDb.medicines.bulkPut(
    medicines.map((m: object) => ({ ...m, tenant_id: tenantId, cached_at: cachedAt }))
  )
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.transactions.where('sync_status').equals('PENDING').count()
}
