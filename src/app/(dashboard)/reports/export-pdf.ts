'use client'

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

export async function exportReportPDF(params: ExportParams) {
  const { pdf } = await import('@react-pdf/renderer')
  const { createElement } = await import('react')
  const { ReportPDFDocument } = await import('./report-pdf-document')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = createElement(ReportPDFDocument as any, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await (pdf as any)(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Laporan_Keuangan_${params.fromDate}_${params.toDate}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
