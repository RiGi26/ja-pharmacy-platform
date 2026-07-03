'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { BookOpen, Plus, Trash2, Loader2, X, FileDown, ShieldAlert } from 'lucide-react'
import { createControlledLog, deleteControlledLog } from './actions'

export interface CdBatch { id: string; batch_number: string; expiry_date: string | null; quantity: number }
export interface CdMedicine { id: string; name: string; drug_class: string; unit: string | null; batches: CdBatch[] }
export interface CdLog {
  id: string; medicine_name: string; drug_class: string; batch_number: string | null; expiry_date: string | null
  patient_name: string; patient_id: string | null; doctor_name: string | null; prescription_no: string | null
  clinic_name: string | null; quantity: number; unit: string | null; dispensed_by_name: string | null
  dispensed_at: string; notes: string | null
}

const CLASS_LABEL: Record<string, string> = { keras: 'Obat Keras', psikotropika: 'Psikotropika', narkotika: 'Narkotika' }
const CLASS_CLS: Record<string, string> = {
  keras: 'bg-amber-50 text-amber-700', psikotropika: 'bg-orange-50 text-orange-700', narkotika: 'bg-red-50 text-red-700',
}
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ControlledDrugManager({
  logs, medicines, month, canManage, canDelete,
}: {
  logs: CdLog[]; medicines: CdMedicine[]; month: string; canManage: boolean; canDelete: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [classFilter, setClassFilter] = useState('')

  // form state
  const [medId, setMedId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [patient, setPatient] = useState('')
  const [patientId, setPatientId] = useState('')
  const [doctor, setDoctor] = useState('')
  const [resepNo, setResepNo] = useState('')
  const [clinic, setClinic] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')

  const selectedMed = medicines.find((m) => m.id === medId)

  const filtered = useMemo(
    () => (classFilter ? logs.filter((l) => l.drug_class === classFilter) : logs),
    [logs, classFilter],
  )

  const resetForm = () => {
    setMedId(''); setBatchId(''); setPatient(''); setPatientId(''); setDoctor(''); setResepNo(''); setClinic(''); setQty('1'); setNotes('')
  }

  const submit = () =>
    startTransition(async () => {
      const res = await createControlledLog({
        medicineId: medId, batchId: batchId || null, patientName: patient, patientId,
        doctorName: doctor, prescriptionNo: resepNo, clinicName: clinic, quantity: Number(qty), notes,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Catatan logbook tersimpan.')
      setShowAdd(false); resetForm(); router.refresh()
    })

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteControlledLog(id)
      if (res.error) { toast.error(res.error); return }
      toast.success('Catatan dihapus.'); router.refresh()
    })

  const changeMonth = (m: string) => { if (m) router.push(`/controlled-drugs?month=${m}`) }

  const exportExcel = () => {
    if (filtered.length === 0) { toast.error('Tidak ada data untuk diekspor.'); return }
    const rows = filtered.map((l) => ({
      Tanggal: fmtDate(l.dispensed_at),
      Golongan: CLASS_LABEL[l.drug_class] ?? l.drug_class,
      Obat: l.medicine_name,
      Batch: l.batch_number ?? '',
      Kadaluarsa: l.expiry_date ? fmtDate(l.expiry_date) : '',
      Jumlah: l.quantity,
      Satuan: l.unit ?? '',
      Pasien: l.patient_name,
      'No. Identitas': l.patient_id ?? '',
      Dokter: l.doctor_name ?? '',
      'No. Resep': l.prescription_no ?? '',
      Klinik: l.clinic_name ?? '',
      Apoteker: l.dispensed_by_name ?? '',
      Catatan: l.notes ?? '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Logbook')
    XLSX.writeFile(wb, `Logbook_Obat_Terkontrol_${month}.xlsx`)
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logbook Obat Terkontrol</h1>
          <p className="mt-1 text-sm text-gray-500">Catatan pengeluaran obat keras, psikotropika & narkotika untuk kepatuhan BPOM.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Catat Pengeluaran
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 apple-shadow">
        <label className="text-xs font-semibold text-gray-500">Bulan
          <input type="month" value={month} onChange={(e) => changeMonth(e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="text-xs font-semibold text-gray-500">Golongan
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={inputCls + ' mt-1'}>
            <option value="">Semua</option>
            <option value="keras">Obat Keras</option>
            <option value="psikotropika">Psikotropika</option>
            <option value="narkotika">Narkotika</option>
          </select>
        </label>
        <div className="ml-auto flex items-end gap-2">
          <span className="text-sm text-gray-400">{filtered.length} catatan</span>
          <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
            <FileDown className="h-4 w-4" /> Export BPOM
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white apple-shadow">
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <BookOpen className="mb-3 h-9 w-9 opacity-40" />
            <p className="text-sm">Belum ada catatan pada periode ini.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: tabel */}
          <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white apple-shadow lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Obat / Golongan</th>
                    <th className="px-4 py-3">Pasien / Dokter</th>
                    <th className="px-4 py-3">Resep</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3">Apoteker</th>
                    {canDelete && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((l) => (
                    <tr key={l.id} className="align-top hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-600">{fmtDate(l.dispensed_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{l.medicine_name}</div>
                        <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${CLASS_CLS[l.drug_class] ?? 'bg-gray-100 text-gray-600'}`}>
                          {CLASS_LABEL[l.drug_class] ?? l.drug_class}
                        </span>
                        {l.batch_number && <div className="mt-0.5 text-xs text-gray-400">Batch {l.batch_number}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{l.patient_name}{l.patient_id ? <span className="text-gray-400"> · {l.patient_id}</span> : ''}</div>
                        {l.doctor_name && <div className="text-xs text-gray-400">dr. {l.doctor_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {l.prescription_no || '—'}
                        {l.clinic_name && <div className="text-xs text-gray-400">{l.clinic_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">{l.quantity}{l.unit ? ` ${l.unit}` : ''}</td>
                      <td className="px-4 py-3 text-gray-500">{l.dispensed_by_name ?? '—'}</td>
                      {canDelete && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { if (confirm('Hapus catatan logbook ini?')) remove(l.id) }} disabled={pending} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label="Hapus">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: kartu (fallback tabel) */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((l) => (
              <div key={l.id} className="rounded-2xl border border-gray-100 bg-white p-4 apple-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{l.medicine_name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${CLASS_CLS[l.drug_class] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CLASS_LABEL[l.drug_class] ?? l.drug_class}
                      </span>
                      {l.batch_number && <span className="text-xs text-gray-400">Batch {l.batch_number}</span>}
                    </div>
                  </div>
                  {canDelete && (
                    <button onClick={() => { if (confirm('Hapus catatan logbook ini?')) remove(l.id) }} disabled={pending} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">Tanggal</span>
                    <span className="text-right text-sm text-gray-800">{fmtDate(l.dispensed_at)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">Pasien / Dokter</span>
                    <span className="text-right text-sm text-gray-800">
                      <span>{l.patient_name}{l.patient_id ? <span className="text-gray-400"> · {l.patient_id}</span> : ''}</span>
                      {l.doctor_name && <span className="block text-xs text-gray-400">dr. {l.doctor_name}</span>}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">Resep</span>
                    <span className="text-right text-sm text-gray-800">
                      {l.prescription_no || '—'}
                      {l.clinic_name && <span className="block text-xs text-gray-400">{l.clinic_name}</span>}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">Jumlah</span>
                    <span className="text-right text-sm font-semibold tabular-nums text-gray-900">{l.quantity}{l.unit ? ` ${l.unit}` : ''}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">Apoteker</span>
                    <span className="text-right text-sm text-gray-800">{l.dispensed_by_name ?? '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Catat Pengeluaran Obat Terkontrol</h3>
              <button onClick={() => setShowAdd(false)} aria-label="Tutup" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            {medicines.length === 0 ? (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Belum ada obat bergolongan keras/psikotropika/narkotika. Set golongan obat di menu Obat lebih dulu.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="cd-med" className="mb-1 block text-xs font-semibold text-gray-500">Obat *</label>
                  <select id="cd-med" value={medId} onChange={(e) => { setMedId(e.target.value); setBatchId('') }} className={inputCls}>
                    <option value="">— Pilih obat terkontrol —</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({CLASS_LABEL[m.drug_class] ?? m.drug_class})</option>
                    ))}
                  </select>
                </div>
                {selectedMed && selectedMed.batches.length > 0 && (
                  <div>
                    <label htmlFor="cd-batch" className="mb-1 block text-xs font-semibold text-gray-500">Batch (opsional)</label>
                    <select id="cd-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputCls}>
                      <option value="">— Tanpa batch —</option>
                      {selectedMed.batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.batch_number} · exp {fmtDate(b.expiry_date)} · sisa {b.quantity}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cd-pat" className="mb-1 block text-xs font-semibold text-gray-500">Nama Pasien *</label>
                    <input id="cd-pat" value={patient} onChange={(e) => setPatient(e.target.value)} className={inputCls} placeholder="Nama pasien" />
                  </div>
                  <div>
                    <label htmlFor="cd-patid" className="mb-1 block text-xs font-semibold text-gray-500">No. Identitas (KTP)</label>
                    <input id="cd-patid" value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputCls} placeholder="opsional" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cd-doc" className="mb-1 block text-xs font-semibold text-gray-500">Nama Dokter</label>
                    <input id="cd-doc" value={doctor} onChange={(e) => setDoctor(e.target.value)} className={inputCls} placeholder="opsional" />
                  </div>
                  <div>
                    <label htmlFor="cd-resep" className="mb-1 block text-xs font-semibold text-gray-500">No. Resep</label>
                    <input id="cd-resep" value={resepNo} onChange={(e) => setResepNo(e.target.value)} className={inputCls} placeholder="opsional" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cd-clinic" className="mb-1 block text-xs font-semibold text-gray-500">Klinik / Asal Resep</label>
                    <input id="cd-clinic" value={clinic} onChange={(e) => setClinic(e.target.value)} className={inputCls} placeholder="opsional" />
                  </div>
                  <div>
                    <label htmlFor="cd-qty" className="mb-1 block text-xs font-semibold text-gray-500">Jumlah *</label>
                    <input id="cd-qty" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label htmlFor="cd-notes" className="mb-1 block text-xs font-semibold text-gray-500">Catatan</label>
                  <input id="cd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="opsional" />
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={submit} disabled={pending || medicines.length === 0 || !medId || !patient.trim() || !(Number(qty) > 0)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
