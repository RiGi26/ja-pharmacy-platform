'use client'

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/utils'

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#6b7280', marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#1d4ed8' },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  headerRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  right: { flex: 1, textAlign: 'right' },
  w18: { width: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  card: { width: '48%', padding: 8, backgroundColor: '#f9fafb', borderRadius: 4, marginBottom: 6, marginRight: '2%' },
  cardLabel: { fontSize: 8, color: '#6b7280' },
  cardValue: { fontSize: 12, fontWeight: 'bold', marginTop: 2 },
})

interface Props {
  fromDate: string
  toDate: string
  summary: {
    totalRevenue: number
    totalDiscount: number
    totalHPP: number
    grossProfit: number
    grossMargin: number
    txCount: number
  }
  topMedicines: { id: string; name: string; quantity: number; revenue: number; hpp: number }[]
  dailyRevenue: { date: string; revenue: number }[]
}

export function ReportPDFDocument({ fromDate, toDate, summary, topMedicines, dailyRevenue }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Laporan Keuangan Apotek</Text>
        <Text style={s.subtitle}>Periode: {fromDate} s.d. {toDate}</Text>

        <View style={s.grid}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total Pendapatan</Text>
            <Text style={[s.cardValue, { color: '#059669' }]}>{formatCurrency(summary.totalRevenue)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Laba Kotor</Text>
            <Text style={[s.cardValue, { color: summary.grossProfit >= 0 ? '#059669' : '#dc2626' }]}>{formatCurrency(summary.grossProfit)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>HPP (COGS)</Text>
            <Text style={[s.cardValue, { color: '#2563eb' }]}>{formatCurrency(summary.totalHPP)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Margin Laba</Text>
            <Text style={[s.cardValue, { color: '#7c3aed' }]}>{summary.grossMargin.toFixed(1)}%</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Top 10 Obat Terlaris</Text>
          <View style={s.headerRow}>
            <Text style={s.w18}>#</Text>
            <Text style={s.flex3}>Nama Obat</Text>
            <Text style={s.right}>Qty</Text>
            <Text style={s.right}>Pendapatan</Text>
            <Text style={s.right}>Laba</Text>
          </View>
          {topMedicines.map((m, i) => (
            <View key={m.id} style={s.row}>
              <Text style={s.w18}>{i + 1}</Text>
              <Text style={s.flex3}>{m.name}</Text>
              <Text style={s.right}>{m.quantity}</Text>
              <Text style={s.right}>{formatCurrency(m.revenue)}</Text>
              <Text style={s.right}>{formatCurrency(m.revenue - m.hpp * m.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Pendapatan Harian</Text>
          <View style={s.headerRow}>
            <Text style={s.flex2}>Tanggal</Text>
            <Text style={s.right}>Pendapatan</Text>
          </View>
          {dailyRevenue.slice(0, 31).map(d => (
            <View key={d.date} style={s.row}>
              <Text style={s.flex2}>{d.date}</Text>
              <Text style={s.right}>{formatCurrency(d.revenue)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
