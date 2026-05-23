import { PageHeader } from '@/components/layout/page-header'
import { DisposalForm } from './disposal-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewDisposalPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Buat Pengajuan Retur / Pemusnahan">
        <Link href="/disposals">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" />Kembali</Button>
        </Link>
      </PageHeader>
      <DisposalForm />
    </div>
  )
}
