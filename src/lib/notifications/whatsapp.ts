interface WaSendParams {
  target: string
  message: string
  token: string
}

export async function sendWhatsApp({ target, message, token }: WaSendParams): Promise<boolean> {
  try {
    const res = await fetch(process.env.FONNTE_API_URL ?? 'https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message, typing: false, delay: 1 }),
    })

    const data = await res.json()
    return data.status === true
  } catch (err) {
    console.error('[WA] Failed to send:', err)
    return false
  }
}

export function buildExpiryMessage(medicineName: string, daysLeft: number, tenantName: string): string {
  if (daysLeft <= 0) {
    return `🚫 *[${tenantName}] OBAT EXPIRED*\n\n*${medicineName}* sudah kedaluwarsa. Segera lakukan penanganan.\n\n_Japan Arena Pharmacy System_`
  }
  const emoji = daysLeft <= 30 ? '🔴' : daysLeft <= 90 ? '🟡' : '🟠'
  return `${emoji} *[${tenantName}] Alert Kedaluwarsa H-${daysLeft}*\n\n*${medicineName}* akan kedaluwarsa dalam *${daysLeft} hari*.\n\nSegera lakukan tindakan yang diperlukan.\n\n_Japan Arena Pharmacy System_`
}

export function buildNewPrescriptionMessage(patientName: string, doctorName: string, tenantName: string): string {
  return `💊 *[${tenantName}] Resep Baru*\n\nPasien: *${patientName}*\nDokter: ${doctorName}\n\nSegera proses di aplikasi.\n\n_Japan Arena Pharmacy System_`
}

export function buildLowStockMessage(medicineName: string, currentStock: number, minStock: number, tenantName: string): string {
  return `⚠️ *[${tenantName}] Stok Rendah*\n\n*${medicineName}*\nStok saat ini: *${currentStock}* (min: ${minStock})\n\nSegera lakukan pemesanan ulang.\n\n_Japan Arena Pharmacy System_`
}
