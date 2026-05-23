import { create } from 'zustand'

export interface CartItem {
  medicine_id: string
  batch_id: string
  name: string
  barcode: string | null
  unit: string
  unit_price: number
  quantity: number
  discount_pct: number
  is_prescription: boolean
  batch_status: string
  max_qty: number
  subtotal: number
}

interface PosState {
  cart: CartItem[]
  paymentMethod: 'cash' | 'qris' | 'transfer'
  paidAmount: number
  prescriptionNumber: string

  addItem: (item: Omit<CartItem, 'subtotal'>) => void
  updateQty: (batch_id: string, qty: number) => void
  removeItem: (batch_id: string) => void
  clearCart: () => void
  setPaymentMethod: (m: 'cash' | 'qris' | 'transfer') => void
  setPaidAmount: (n: number) => void
  setPrescriptionNumber: (n: string) => void

  get subtotal(): number
  get discount(): number
  get total(): number
  get change(): number
  get hasRequiresPrescription(): boolean
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  paymentMethod: 'cash',
  paidAmount: 0,
  prescriptionNumber: '',

  addItem: (item) => set(state => {
    const existing = state.cart.find(c => c.batch_id === item.batch_id)
    if (existing) {
      const newQty = Math.min(existing.quantity + item.quantity, item.max_qty)
      return {
        cart: state.cart.map(c =>
          c.batch_id === item.batch_id
            ? { ...c, quantity: newQty, subtotal: newQty * c.unit_price * (1 - c.discount_pct / 100) }
            : c
        ),
      }
    }
    const subtotal = item.quantity * item.unit_price * (1 - item.discount_pct / 100)
    return { cart: [...state.cart, { ...item, subtotal }] }
  }),

  updateQty: (batch_id, qty) => set(state => ({
    cart: state.cart
      .map(c => c.batch_id === batch_id
        ? { ...c, quantity: qty, subtotal: qty * c.unit_price * (1 - c.discount_pct / 100) }
        : c
      )
      .filter(c => c.quantity > 0),
  })),

  removeItem: (batch_id) => set(state => ({ cart: state.cart.filter(c => c.batch_id !== batch_id) })),

  clearCart: () => set({ cart: [], paidAmount: 0, prescriptionNumber: '' }),

  setPaymentMethod: (m) => set({ paymentMethod: m }),
  setPaidAmount: (n) => set({ paidAmount: n }),
  setPrescriptionNumber: (n) => set({ prescriptionNumber: n }),

  get subtotal() { return get().cart.reduce((s, c) => s + c.quantity * c.unit_price, 0) },
  get discount() { return get().cart.reduce((s, c) => s + c.quantity * c.unit_price * (c.discount_pct / 100), 0) },
  get total() { return get().cart.reduce((s, c) => s + c.subtotal, 0) },
  get change() { return Math.max(0, get().paidAmount - get().total) },
  get hasRequiresPrescription() { return get().cart.some(c => c.is_prescription) },
}))
