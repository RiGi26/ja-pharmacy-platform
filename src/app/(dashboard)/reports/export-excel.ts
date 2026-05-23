'use client'

import * as XLSX from 'xlsx'
import { formatCurrency } from '@/lib/utils'

interface ExportParams {
  dailyRevenue: { date: string; revenue: number }[]
  topMedicines: { id: string; name: string; quantity: number; revenue: number; hpp: number }[]
  summary: {
    totalRevenue: number
    totalDiscount: number
    totalHPP: number
    grossProfit: number
    grossMargin: number
    txCount: number
  }
  fromDate: string
  toDate: string
}

export async function exportReportExcel({ dailyRevenue, topMedicines, summary, fromDate, toDate }: ExportParams) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = [
    ['Laporan Keuangan Apotek'],
    [`Periode: ${fromDate} s.d. ${toDate}`],
    [],
    ['Keterangan', 'Nilai'],
    ['Total Pendapatan', summary.totalRevenue],
    ['Total Diskon', summary.totalDiscount],
    ['HPP (COGS)', summary.totalHPP],
    ['Laba Kotor', summary.grossProfit],
    ['Margin Laba (%)', `${summary.grossMargin.toFixed(1)}%`],
    ['Jumlah Transaksi', summary.txCount],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan')

  // Sheet 2: Daily Revenue
  const dailyData = [
    ['Tanggal', 'Pendapatan (IDR)'],
    ...dailyRevenue.map(d => [d.date, d.revenue]),
  ]
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyData)
  wsDaily['!cols'] = [{ wch: 14 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Pendapatan Harian')

  // Sheet 3: Top Medicines
  const medData = [
    ['#', 'Nama Obat', 'Qty Terjual', 'Pendapatan (IDR)', 'HPP (IDR)', 'Laba Kotor (IDR)'],
    ...topMedicines.map((m, i) => [
      i + 1,
      m.name,
      m.quantity,
      m.revenue,
      m.hpp * m.quantity,
      m.revenue - m.hpp * m.quantity,
    ]),
  ]
  const wsMed = XLSX.utils.aoa_to_sheet(medData)
  wsMed['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsMed, 'Top Obat')

  XLSX.writeFile(wb, `Laporan_Keuangan_${fromDate}_${toDate}.xlsx`)
}
