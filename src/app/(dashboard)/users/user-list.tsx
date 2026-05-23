'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { UserPlus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { UserRole } from '@/types'

interface UserProfile {
  id: string
  user_id: string
  full_name: string
  email: string
  role: string
  phone: string | null
  is_active: boolean
  created_at: string
}

interface Props {
  users: UserProfile[]
  tenantId: string
  currentUserId: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  apoteker: 'Apoteker',
  kasir: 'Kasir',
}

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  apoteker: 'outline',
  kasir: 'outline',
}

export function UserList({ users: initialUsers, tenantId, currentUserId }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [showInvite, setShowInvite] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('kasir')
  const [inviteFullName, setInviteFullName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  async function toggleActive(u: UserProfile) {
    setLoading(u.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !u.is_active })
      .eq('id', u.id)

    if (error) { toast.error(error.message) } else {
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_active: !p.is_active } : p))
      toast.success(u.is_active ? 'Akun dinonaktifkan' : 'Akun diaktifkan')
    }
    setLoading(null)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail || !inviteFullName) { toast.error('Email dan nama wajib diisi'); return }
    setInviteLoading(true)

    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, full_name: inviteFullName, phone: invitePhone, tenant_id: tenantId }),
    })
    const data = await res.json()

    if (!res.ok) { toast.error(data.error ?? 'Gagal mengundang pengguna') }
    else {
      toast.success(`Undangan dikirim ke ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail(''); setInviteFullName(''); setInvitePhone('')
      router.refresh()
    }
    setInviteLoading(false)
  }

  const columns = [
    {
      key: 'name',
      header: 'Nama',
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserProfile
        return (
          <div>
            <p className="font-medium text-gray-900">{u.full_name}</p>
            <p className="text-xs text-gray-400">{u.email}</p>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Peran',
      render: (row: Record<string, unknown>) => (
        <Badge variant={ROLE_VARIANTS[String(row.role)] ?? 'outline'}>
          {ROLE_LABELS[String(row.role)] ?? String(row.role)}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Telepon',
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-gray-500">{String(row.phone ?? '—')}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row: Record<string, unknown>) => (
        <Badge variant={row.is_active ? 'success' : 'secondary'}>
          {row.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Bergabung',
      render: (row: Record<string, unknown>) => (
        <span className="text-xs text-gray-400">{formatDate(String(row.created_at))}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Record<string, unknown>) => {
        const u = row as unknown as UserProfile
        if (u.user_id === currentUserId) return null
        return (
          <Button
            size="sm" variant="ghost"
            onClick={() => toggleActive(u)}
            disabled={loading === u.id}
            className="h-7 gap-1 text-gray-500"
          >
            {loading === u.id
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : u.is_active
              ? <ToggleRight className="w-4 h-4 text-emerald-500" />
              : <ToggleLeft className="w-4 h-4 text-gray-400" />
            }
            {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowInvite(v => !v)}>
          <UserPlus className="w-4 h-4" />
          Undang Pengguna
        </Button>
      </div>

      {showInvite && (
        <Card>
          <CardHeader><CardTitle className="text-base">Undang Pengguna Baru</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nama Lengkap *</label>
                <Input value={inviteFullName} onChange={e => setInviteFullName(e.target.value)} placeholder="Nama staf" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email *</label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@apotek.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">No. Telepon (WA)</label>
                <Input value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="628xxxxxxxxx" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Peran *</label>
                <select
                  className="h-10 w-full px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as UserRole)}
                >
                  <option value="admin">Admin</option>
                  <option value="apoteker">Apoteker</option>
                  <option value="kasir">Kasir</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Batal</Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kirim Undangan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable
        data={users as unknown as Record<string, unknown>[]}
        columns={columns}
        keyField="id"
        emptyMessage="Belum ada pengguna"
      />
    </div>
  )
}
