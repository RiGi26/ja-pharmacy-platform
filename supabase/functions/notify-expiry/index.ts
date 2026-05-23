import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function sendWa(target: string, message: string, token: string) {
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date()
  const milestones = [180, 90, 30]

  for (const days of milestones) {
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + days)
    const dateStr = targetDate.toISOString().slice(0, 10)

    const { data: batches } = await supabase
      .from('medicine_batches')
      .select('id, medicine_id, tenant_id, expiry_date, medicines(name), tenants(name, wa_number), tenant_configs(wa_token, wa_sender, expired_warn_h180, expired_warn_h90)')
      .eq('expiry_date', dateStr)
      .not('status', 'in', '("DISPOSED","RETURNED","EMPTY")')

    for (const batch of batches ?? []) {
      const medicine = batch.medicines as { name: string } | null
      const tenant = batch.tenants as { name: string; wa_number: string } | null
      const config = batch.tenant_configs as { wa_token: string; expired_warn_h180: boolean; expired_warn_h90: boolean } | null

      if (!medicine || !tenant || !config?.wa_token) continue
      if (days === 180 && !config.expired_warn_h180) continue
      if (days === 90 && !config.expired_warn_h90) continue

      // Get owners & apotekers to notify
      const { data: users } = await supabase
        .from('user_profiles')
        .select('phone')
        .eq('tenant_id', batch.tenant_id)
        .in('role', ['owner', 'apoteker'])
        .eq('is_active', true)

      const msg = `⚠️ *[${tenant.name}] Alert H-${days}*\n\n*${medicine.name}* akan kedaluwarsa dalam *${days} hari*.\n\nSegera lakukan tindakan.\n\n_Japan Arena Pharmacy_`

      for (const u of users ?? []) {
        if (u.phone) {
          await sendWa(u.phone, msg, config.wa_token)
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
