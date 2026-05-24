import Dexie, { Table } from 'dexie'

export interface OfflineTransaction {
  id: string              // client-generated UUID
  tenant_id: string
  user_id: string
  invoice_number: string
  payment_method: string
  subtotal: number
  discount: number
  total: number
  paid_amount: number
  change_amount: number
  items: OfflineTxItem[]
  created_at: string      // ISO string
  sync_status: 'PENDING' | 'SYNCED' | 'CONFLICT' | 'ERROR'
  sync_error?: string
  server_id?: string      // assigned by server after sync
}

export interface OfflineTxItem {
  medicine_id: string
  batch_id: string
  medicine_name: string
  quantity: number
  unit_price: number
  discount_pct: number
  subtotal: number
}

export interface CachedMedicine {
  id: string
  tenant_id: string
  name: string
  barcode: string | null
  hpp: number
  sell_price: number
  unit: string
  is_prescription: boolean
  batches: CachedBatch[]
  cached_at: string
}

export interface CachedBatch {
  id: string
  batch_number: string
  quantity: number
  expiry_date: string
  status: string
  buy_price: number
  discount_pct: number
}

class OfflineDatabase extends Dexie {
  transactions!: Table<OfflineTransaction>
  medicines!: Table<CachedMedicine>

  constructor() {
    super('ja-pharmacy-offline')
    this.version(1).stores({
      transactions: 'id, tenant_id, sync_status, created_at',
      medicines: 'id, tenant_id, barcode',
    })
  }
}

export const offlineDb = new OfflineDatabase()
