'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { RevenueChart } from './revenue-chart'
import { TopMedicinesTable } from './top-medicines-table'
import { PaymentPieChart } from './payment-pie-chart'
import { TrendingUp, ShoppingCart, DollarSign, Percent, Download } from 'lucide-react'
import { exportReportExcel } from './export-excel'
import { exportReportPDF } from './export-pdf'

interface Props {
  period: string
  fromDate: string
  toDate: string
  dailyRevenue: { date: string; revenue: number }[]
  topMedicines: { id: string; name: string; quantity: number; revenue: number; hpp: number }[]
  paymentData: { method: string; amount: number }[]
  summary: {
    totalRevenue: number
    totalDiscount: number
    totalHPP: number
    grossProfit: number
    grossMargin: number
    txCount: number
  }
  tenantId: string
}

const PERIODS = [
  { label: 'Hari Ini', value: 'today' },
  { label: '7 Hari', value: '7d' },
  { label: '30 Hari', value: '30d' },
  { label: 'Bulan Ini', value: 'month' },
  { label: 'Custom', value: 'custom' },
]

export function ReportsClient({ period, fromDate, toDate, dailyRevenue, topMedicines, paymentData, summary, tenantId }: Props) {
  const router = useRouter()
  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo] = useState(toDate)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  function applyPeriod(p: string) {
    if (p === 'custom') {
      router.push(`/reports?period=custom&from=${customFrom}&to=${customTo}`)
    } else {
      router.push(`/reports?period=${p}`)
    }
  }

  async function handleExportExcel() {
    setExporting('excel')
    await exportReportExcel({ dailyRevenue, topMedicines, summary, fromDate, toDate })
    setExporting(null)
  }

  async function handleExportPDF() {
    setExporting('pdf')
    await exportReportPDF({ dailyRevenue, topMedicines, summary, fromDate, toDate })
    setExporting(null)
  }

  const summaryCards = [
    {
      title: 'Total Pendapatan',
      value: formatCurrency(summary.totalRevenue),
      sub: `${summary.txCount} transaksi`,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Total Diskon',
      value: formatCurrency(summary.totalDiscount),
      sub: 'Diskon diberikan',
      icon: Percent,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'HPP (COGS)',
      value: formatCurrency(summary.totalHPP),
      sub: 'Harga pokok penjualan',
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Laba Kotor',
      value: formatCurrency(summary.grossProfit),
      sub: `Margin ${summary.grossMargin.toFixed(1)}%`,
      icon: TrendingUp,
      color: summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: summary.grossProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => applyPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-sm w-36" />
            <span className="text-gray-400 text-sm">—</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-sm w-36" />
            <Button size="sm" onClick={() => router.push(`/reports?period=custom&from=${customFrom}&to=${customTo}`)}>
              Terapkan
            </Button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={exporting !== null}>
            <Download className="w-3.5 h-3.5" />
            {exporting === 'excel' ? 'Exporting…' : 'Excel'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={exporting !== null}>
            <Download className="w-3.5 h-3.5" />
            {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{card.title}</p>
                  <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                </div>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grafik Pendapatan Harian</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={dailyRevenue} />
        </CardContent>
      </Card>

      {/* Top medicines + payment breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Obat Terlaris</CardTitle>
            </CardHeader>
            <CardContent>
              <TopMedicinesTable data={topMedicines} />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metode Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentPieChart data={paymentData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
