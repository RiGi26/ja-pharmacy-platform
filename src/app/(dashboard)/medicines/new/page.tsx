import { PageHeader } from '@/components/layout/page-header'
import { MedicineForm } from '../medicine-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewMedicinePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Tambah Obat Baru">
        <Link href="/medicines">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
        </Link>
      </PageHeader>
      <MedicineForm />
    </div>
  )
}
