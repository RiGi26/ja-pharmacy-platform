'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const COLORS: Record<string, string> = {
  CASH: '#10b981',
  QRIS: '#6366f1',
  DEBIT: '#3b82f6',
  KREDIT: '#f59e0b',
  TRANSFER: '#8b5cf6',
}

const DEFAULT_COLOR = '#9ca3af'

interface Props {
  data: { method: string; amount: number }[]
}

const RADIAN = Math.PI / 180
function renderLabel(props: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number }) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function PaymentPieChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Tidak ada data</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="method"
          cx="50%"
          cy="50%"
          outerRadius={90}
          labelLine={false}
          label={renderLabel}
        >
          {data.map((entry) => (
            <Cell key={entry.method} fill={COLORS[entry.method] ?? DEFAULT_COLOR} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
