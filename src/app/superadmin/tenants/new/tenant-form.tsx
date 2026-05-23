'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { slugify } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function TenantForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', slug: '', email: '', wa_number: '', phone: '', address: '',
  })

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) { toast.error('Nama dan slug wajib diisi'); return }

    setLoading(true)
    const supabase = createClient()

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({ ...form, status: 'active' })
      .select()
      .single()

    if (error) { toast.error(error.message); setLoading(false); return }

    // Create default tenant config
    await supabase.from('tenant_configs').insert({ tenant_id: tenant.id })

    toast.success(`Apotek "${form.name}" berhasil didaftarkan`)
    router.push('/superadmin')
    router.refresh()
  }

  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader><CardTitle>Informasi Apotek</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama Apotek" required>
            <Input
              value={form.name}
              onChange={e => {
                set('name', e.target.value)
                set('slug', slugify(e.target.value))
              }}
              placeholder="Apotek Sehat Sentosa"
            />
          </Field>
          <Field label="Slug (subdomain)" required>
            <div className="flex items-center">
              <Input
                value={form.slug}
                onChange={e => set('slug', slugify(e.target.value))}
                placeholder="apotek-sehat"
                className="rounded-r-none"
              />
              <span className="h-10 px-3 flex items-center bg-gray-50 border border-l-0 border-gray-200 rounded-r-xl text-xs text-gray-400 whitespace-nowrap">
                .japanarenacorp.com
              </span>
            </div>
          </Field>
          <Field label="Email Pemilik">
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@apotek.com" />
          </Field>
          <Field label="No. WhatsApp">
            <Input value={form.wa_number} onChange={e => set('wa_number', e.target.value)} placeholder="6281234567890" />
          </Field>
          <Field label="No. Telepon">
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="02112345678" />
          </Field>
          <Field label="Alamat">
            <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Jl. Kesehatan No. 1" />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-5">
        <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Daftarkan Apotek
        </Button>
      </div>
    </form>
  )
}
