import { PageHeader } from '@/components/layout/page-header'
import { StockInForm } from './stock-in-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function StockInPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Input Barang Masuk" description="Tambah batch stok baru atau update batch yang ada">
        <Link href="/inventory">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
        </Link>
      </PageHeader>
      <StockInForm />
    </div>
  )
}
