'use client'

import { useEffect, useState } from 'react'

// Sapaan harus ikut jam lokal perangkat user, bukan jam server Vercel (UTC).
// SSR/first paint pakai perkiraan WIB; setelah hydrate dikoreksi ke jam device.
function greet(hour: number): string {
  if (hour < 12) return 'Selamat pagi'
  if (hour < 17) return 'Selamat siang'
  return 'Selamat malam'
}

export function Greeting() {
  const [hour, setHour] = useState(() => (new Date().getUTCHours() + 7) % 24)
  useEffect(() => {
    setHour(new Date().getHours())
  }, [])
  return <>{greet(hour)}</>
}
