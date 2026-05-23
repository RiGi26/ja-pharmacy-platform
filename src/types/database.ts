export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          address: string | null
          phone: string | null
          wa_number: string | null
          email: string | null
          logo_url: string | null
          status: 'active' | 'suspended' | 'trial'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      tenant_configs: {
        Row: {
          id: string
          tenant_id: string
          wa_token: string | null
          wa_sender: string | null
          clinic_webhook_secret: string | null
          clinic_api_url: string | null
          printer_width: number
          expired_warn_h180: boolean
          expired_warn_h90: boolean
          auto_daily_report: boolean
          notif_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenant_configs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenant_configs']['Insert']>
      }
      user_profiles: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          full_name: string
          role: 'superadmin' | 'owner' | 'admin' | 'apoteker' | 'kasir'
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      medicines: {
        Row: {
          id: string
          tenant_id: string
          barcode: string | null
          name: string
          generic_name: string | null
          category: string | null
          drug_class: 'bebas' | 'bebas_terbatas' | 'keras' | 'psikotropika' | 'narkotika' | null
          unit: string | null
          sell_price: number
          rack_location: string | null
          min_stock: number
          is_prescription: boolean
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['medicines']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['medicines']['Insert']>
      }
      medicine_batches: {
        Row: {
          id: string
          tenant_id: string
          medicine_id: string
          batch_number: string
          supplier_id: string | null
          expiry_date: string
          quantity: number
          buy_price: number
          status: 'LAYAK_JUAL' | 'WARNING' | 'DILARANG_JUAL' | 'DISPOSED' | 'RETURNED' | 'EMPTY'
          discount_pct: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['medicine_batches']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['medicine_batches']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          tenant_id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          tenant_id: string
          invoice_number: string
          cashier_id: string
          shift_id: string | null
          prescription_id: string | null
          payment_method: 'cash' | 'qris' | 'transfer'
          subtotal: number
          discount: number
          total: number
          paid_amount: number
          change_amount: number
          status: 'COMPLETED' | 'VOIDED' | 'PENDING_VOID'
          offline_local_id: string | null
          void_reason: string | null
          void_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      transaction_items: {
        Row: {
          id: string
          tenant_id: string
          transaction_id: string
          medicine_id: string
          batch_id: string
          quantity: number
          unit_price: number
          discount_pct: number
          subtotal: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transaction_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transaction_items']['Insert']>
      }
      stock_movements: {
        Row: {
          id: string
          tenant_id: string
          medicine_id: string
          batch_id: string
          type: 'IN' | 'OUT' | 'ADJUST' | 'RETURN' | 'DISPOSE' | 'VOID_ROLLBACK' | 'DISPENSING' | 'INITIAL'
          quantity: number
          ref_id: string | null
          ref_type: string | null
          note: string | null
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at'>
        Update: never
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'VOID' | 'LOGIN' | 'LOGOUT'
          table_name: string
          record_id: string
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
      prescriptions: {
        Row: {
          id: string
          tenant_id: string
          clinic_prescription_id: string
          patient_name: string
          patient_phone: string | null
          doctor_name: string | null
          clinic_name: string | null
          items: Json
          status: 'PENDING' | 'PROCESSING' | 'DISPENSED' | 'CANCELLED'
          dispensed_by: string | null
          dispensed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['prescriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['prescriptions']['Insert']>
      }
      shifts: {
        Row: {
          id: string
          tenant_id: string
          cashier_id: string
          opening_balance: number
          closing_balance: number | null
          total_transactions: number
          total_cash: number
          total_qris: number
          total_transfer: number
          opened_at: string
          closed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['shifts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['shifts']['Insert']>
      }
      disposals: {
        Row: {
          id: string
          tenant_id: string
          type: 'RETURN' | 'DESTRUCTION'
          medicine_id: string
          batch_id: string
          quantity: number
          reason: string
          submitted_by: string
          approved_by: string | null
          status: 'PENDING' | 'APPROVED' | 'REJECTED'
          supplier_id: string | null
          document_url: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['disposals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['disposals']['Insert']>
      }
      price_histories: {
        Row: {
          id: string
          tenant_id: string
          medicine_id: string
          old_sell_price: number
          new_sell_price: number
          changed_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['price_histories']['Row'], 'id' | 'created_at'>
        Update: never
      }
      scan_logs: {
        Row: {
          id: string
          tenant_id: string
          barcode: string
          scanned_by: string
          context: string
          medicine_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['scan_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
