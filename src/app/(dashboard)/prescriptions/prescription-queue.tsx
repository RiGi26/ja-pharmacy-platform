'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import { FileText, CheckCircle, Clock, User, Stethoscope, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'

type Prescription = Database['public']['Tables']['prescriptions']['Row']

interface Props {
  pending: Prescription[]
  dispensed: Prescription[]
  tenantId: string
  userId: string
}

export function PrescriptionQueue({ pending, dispensed, tenantId, userId }: Props) {
  const router = useRouter()
  const [dispensing, setDispensing] = useState<string | null>(null)

  async function handleDispense(prescription: Prescription) {
    setDispensing(prescription.id)
    const supabase = createClient()

    const { error } = await supabase
      .from('prescriptions')
      .update({
        status: 'DISPENSED',
        dispensed_by: userId,
        dispensed_at: new Date().toISOString(),
      })
      .eq('id', prescription.id)
      .eq('tenant_id', tenantId)

    setDispensing(null)

    if (error) { toast.error(error.message); return }

    toast.success(`Resep ${prescription.patient_name} berhasil di-dispense`)
    router.refresh()
  }

  async function handleProcess(id: string) {
    const supabase = createClient()
    await supabase
      .from('prescriptions')
      .update({ status: 'PROCESSING' })
      .eq('id', id)
    router.refresh()
  }

  const PrescriptionCard = ({ rx, showDispenseBtn }: { rx: Prescription; showDispenseBtn: boolean }) => {
    const items = (rx.items as unknown[]) ?? []
    return (
      <Card className="mb-3">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={rx.status === 'PENDING' ? 'warning' : rx.status === 'PROCESSING' ? 'default' : 'success'}>
                  {rx.status === 'PENDING' ? '⏳ Menunggu' : rx.status === 'PROCESSING' ? '⚙️ Diproses' : '✓ Dispensed'}
                </Badge>
                <span className="text-xs text-gray-400 font-mono">{rx.clinic_prescription_id}</span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" />{rx.patient_name}</span>
                {rx.doctor_name && <span className="flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5 text-gray-400" />{rx.doctor_name}</span>}
                {rx.clinic_name && <span className="text-gray-400 text-xs">{rx.clinic_name}</span>}
              </div>

              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(rx.created_at)}
              </div>

              {/* Prescription items */}
              {items.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-2 mt-2">
                  {(items as Array<{ name?: string; quantity?: number; dose?: string }>).map((item, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      {i + 1}. {item.name ?? 'Obat'} — {item.quantity ?? '?'} {item.dose ?? ''}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {showDispenseBtn && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                {rx.status === 'PENDING' && (
                  <Button size="sm" variant="outline" onClick={() => handleProcess(rx.id)}>
                    Proses
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => handleDispense(rx)}
                  disabled={dispensing === rx.id}
                >
                  {dispensing === rx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Dispense
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending queue */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-500" />
          Antrian ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <CheckCircle className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">Tidak ada resep pending</p>
          </div>
        ) : (
          pending.map(rx => <PrescriptionCard key={rx.id} rx={rx} showDispenseBtn={true} />)
        )}
      </div>

      {/* Dispensed */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Sudah Dispensed (20 terbaru)
        </h2>
        {dispensed.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <p className="text-sm">Belum ada resep yang di-dispense</p>
          </div>
        ) : (
          dispensed.map(rx => <PrescriptionCard key={rx.id} rx={rx} showDispenseBtn={false} />)
        )}
      </div>
    </div>
  )
}
