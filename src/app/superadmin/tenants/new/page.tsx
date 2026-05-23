import { PageHeader } from '@/components/layout/page-header'
import { TenantForm } from './tenant-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewTenantPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Daftarkan Apotek Baru">
        <Link href="/superadmin">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" />Kembali</Button>
        </Link>
      </PageHeader>
      <TenantForm />
    </div>
  )
}
