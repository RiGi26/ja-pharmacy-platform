'use client'

import { formatCurrency } from '@/lib/utils'

interface MedRow {
  id: string
  name: string
  quantity: number
  revenue: number
  hpp: number
}

interface Props {
  data: MedRow[]
}

export function TopMedicinesTable({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Tidak ada data penjualan</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">#</th>
            <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Nama Obat</th>
            <th className="text-right py-2 pr-3 text-xs font-semibold text-gray-500">Qty</th>
            <th className="text-right py-2 pr-3 text-xs font-semibold text-gray-500">Pendapatan</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500">Laba Kotor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const grossProfit = row.revenue - row.hpp * row.quantity
            return (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                <td className="py-2 pr-3 font-medium text-gray-900 max-w-[180px] truncate">{row.name}</td>
                <td className="py-2 pr-3 text-right text-gray-600">{row.quantity.toLocaleString('id-ID')}</td>
                <td className="py-2 pr-3 text-right font-semibold text-gray-800">{formatCurrency(row.revenue)}</td>
                <td className={`py-2 text-right font-semibold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(grossProfit)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
