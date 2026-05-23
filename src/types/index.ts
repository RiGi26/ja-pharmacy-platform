export type UserRole = 'superadmin' | 'owner' | 'admin' | 'apoteker' | 'kasir'

export type TenantStatus = 'active' | 'suspended' | 'trial'

export type BatchStatus =
  | 'LAYAK_JUAL'
  | 'WARNING'
  | 'DILARANG_JUAL'
  | 'DISPOSED'
  | 'RETURNED'
  | 'EMPTY'

export type DrugClass =
  | 'bebas'
  | 'bebas_terbatas'
  | 'keras'
  | 'psikotropika'
  | 'narkotika'

export type PaymentMethod = 'cash' | 'qris' | 'transfer'

export type TransactionStatus = 'COMPLETED' | 'VOIDED' | 'PENDING_VOID'

export type StockMovementType =
  | 'IN'
  | 'OUT'
  | 'ADJUST'
  | 'RETURN'
  | 'DISPOSE'
  | 'VOID_ROLLBACK'
  | 'DISPENSING'
  | 'INITIAL'

export type PrescriptionStatus = 'PENDING' | 'PROCESSING' | 'DISPENSED' | 'CANCELLED'

export type DisposalType = 'RETURN' | 'DESTRUCTION'

export type DisposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TenantContext {
  id: string
  name: string
  slug: string
  status: TenantStatus
}

export interface UserProfile {
  id: string
  tenant_id: string
  user_id: string
  full_name: string
  role: UserRole
  phone?: string
  is_active: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string | null
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}
