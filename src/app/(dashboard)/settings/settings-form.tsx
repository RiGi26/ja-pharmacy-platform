'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Copy, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Tenant {
  id: string; name: string; slug: string
  address: string | null; phone: string | null; email: string | null
}
interface Config {
  wa_token: string | null
  low_stock_threshold: number | null
  webhook_secret: string | null
  printer_name: string | null
  notif_low_stock: boolean | null
  notif_expiry: boolean | null
  notif_void: boolean | null
  notif_disposal: boolean | null
}

interface Props {
  tenant: Tenant | null
  config: Config | null
  tenantId: string
}

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-10 h-5.5 rounded-full transition-colors duration-200',
          enabled ? 'bg-blue-600' : 'bg-gray-200'
        )}
        style={{ height: 22, width: 40 }}
      >
        <span className={cn(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </button>
    </label>
  )
}

export function SettingsForm({ tenant, config, tenantId }: Props) {
  const [loadingTenant, setLoadingTenant] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)

  const [tenantForm, setTenantForm] = useState({
    name: tenant?.name ?? '',
    address: tenant?.address ?? '',
    phone: tenant?.phone ?? '',
    email: tenant?.email ?? '',
  })

  const [configForm, setConfigForm] = useState({
    wa_token: config?.wa_token ?? '',
    low_stock_threshold: String(config?.low_stock_threshold ?? 10),
    printer_name: config?.printer_name ?? '',
    webhook_secret: config?.webhook_secret ?? '',
    notif_low_stock: config?.notif_low_stock ?? true,
    notif_expiry: config?.notif_expiry ?? true,
    notif_void: config?.notif_void ?? true,
    notif_disposal: config?.notif_disposal ?? true,
  })

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault()
    setLoadingTenant(true)
    const supabase = createClient()
    const { error } = await supabase.from('tenants').update({
      name: tenantForm.name,
      address: tenantForm.address || null,
      phone: tenantForm.phone || null,
      email: tenantForm.email || null,
    }).eq('id', tenantId)
    if (error) toast.error(error.message)
    else toast.success('Data apotek berhasil disimpan')
    setLoadingTenant(false)
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    setLoadingConfig(true)
    const supabase = createClient()
    const payload = {
      tenant_id: tenantId,
      wa_token: configForm.wa_token || null,
      low_stock_threshold: Number(configForm.low_stock_threshold) || 10,
      printer_name: configForm.printer_name || null,
      webhook_secret: configForm.webhook_secret || null,
      notif_low_stock: configForm.notif_low_stock,
      notif_expiry: configForm.notif_expiry,
      notif_void: configForm.notif_void,
      notif_disposal: configForm.notif_disposal,
    }
    const { error } = await supabase.from('tenant_configs').upsert(payload, { onConflict: 'tenant_id' })
    if (error) toast.error(error.message)
    else toast.success('Konfigurasi berhasil disimpan')
    setLoadingConfig(false)
  }

  function generateWebhookSecret() {
    const arr = new Uint8Array(24)
    crypto.getRandomValues(arr)
    const secret = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
    setConfigForm(f => ({ ...f, webhook_secret: secret }))
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Disalin ke clipboard')
  }

  return (
    <div className="space-y-6">
      {/* Apotek info */}
      <Card>
        <CardHeader><CardTitle>Informasi Apotek</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveTenant} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nama Apotek *</label>
                <Input value={tenantForm.name} onChange={e => setTenantForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Subdomain</label>
                <Input value={tenant?.slug ?? ''} disabled className="opacity-60" />
                <p className="text-xs text-gray-400 mt-1">{tenant?.slug}.japanarenacorp.com</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">No. Telepon</label>
                <Input value={tenantForm.phone} onChange={e => setTenantForm(f => ({ ...f, phone: e.target.value }))} placeholder="021-xxx-xxxx" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                <Input type="email" value={tenantForm.email} onChange={e => setTenantForm(f => ({ ...f, email: e.target.value }))} placeholder="apotek@email.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Alamat</label>
                <Input value={tenantForm.address} onChange={e => setTenantForm(f => ({ ...f, address: e.target.value }))} placeholder="Jl. ..." />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loadingTenant}>
                {loadingTenant && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader><CardTitle>Notifikasi WhatsApp</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Token Fonnte API</label>
              <Input
                type="password"
                value={configForm.wa_token}
                onChange={e => setConfigForm(f => ({ ...f, wa_token: e.target.value }))}
                placeholder="Token dari fonnte.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                Dapatkan token di <span className="font-mono">fonnte.com</span> — daftarkan nomor WhatsApp Owner/Admin.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Threshold Stok Rendah</label>
              <Input
                type="number" min={1}
                value={configForm.low_stock_threshold}
                onChange={e => setConfigForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
                className="w-24"
              />
              <p className="text-xs text-gray-400 mt-1">Notifikasi dikirim jika total stok di bawah angka ini.</p>
            </div>

            <div className="border border-gray-100 rounded-xl px-4 py-1 divide-y divide-gray-50">
              <Toggle label="Notifikasi Stok Rendah" enabled={configForm.notif_low_stock} onChange={v => setConfigForm(f => ({ ...f, notif_low_stock: v }))} />
              <Toggle label="Notifikasi Obat Kadaluwarsa" enabled={configForm.notif_expiry} onChange={v => setConfigForm(f => ({ ...f, notif_expiry: v }))} />
              <Toggle label="Notifikasi Request Void Transaksi" enabled={configForm.notif_void} onChange={v => setConfigForm(f => ({ ...f, notif_void: v }))} />
              <Toggle label="Notifikasi Pengajuan Retur/Pemusnahan" enabled={configForm.notif_disposal} onChange={v => setConfigForm(f => ({ ...f, notif_disposal: v }))} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loadingConfig}>
                {loadingConfig && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Konfigurasi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Printer + Webhook */}
      <Card>
        <CardHeader><CardTitle>Printer & Integrasi Klinik</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nama Printer Struk</label>
              <Input
                value={configForm.printer_name}
                onChange={e => setConfigForm(f => ({ ...f, printer_name: e.target.value }))}
                placeholder="EPSON TM-T82"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Webhook Secret (HMAC)</label>
              <div className="flex gap-2">
                <Input
                  value={configForm.webhook_secret}
                  onChange={e => setConfigForm(f => ({ ...f, webhook_secret: e.target.value }))}
                  placeholder="— Generate secret —"
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={generateWebhookSecret} title="Generate baru">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                {configForm.webhook_secret && (
                  <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(configForm.webhook_secret)} title="Copy">
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Gunakan secret ini sebagai header <span className="font-mono">X-Webhook-Signature</span> pada integrasi klinik.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loadingConfig}>
                {loadingConfig && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
