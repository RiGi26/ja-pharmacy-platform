'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Loader2, Play } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDemoLogin() {
    setLoading(true)
    const demoEmail = 'demo@japanarena.com'
    const demoPassword = 'password123'
    
    setEmail(demoEmail)
    setPassword(demoPassword)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ 
      email: demoEmail, 
      password: demoPassword 
    })

    if (error) {
      toast.error('Gagal masuk ke akun demo. Silakan coba manual.')
      setLoading(false)
      return
    }

    toast.success('Masuk sebagai akun Demo')
    router.replace('/dashboard')
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Email atau password salah'
        : error.message
      )
      setLoading(false)
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
          <Input
            type="email"
            placeholder="nama@apotek.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            className="rounded-xl h-12 border-black/[0.05] focus:ring-blue-600/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
          <div className="relative">
            <Input
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10 rounded-xl h-12 border-black/[0.05] focus:ring-blue-600/20"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-bold" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Masuk ke Dashboard
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-black/[0.05]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-gray-400 font-bold tracking-widest">Atau</span>
        </div>
      </div>

      <Button 
        type="button" 
        variant="outline" 
        onClick={handleDemoLogin}
        disabled={loading}
        className="w-full h-12 rounded-xl border-blue-100 bg-blue-50/50 text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all font-bold flex items-center justify-center gap-2"
      >
        <Play size={16} className="fill-blue-600" />
        Coba Akun Demo
      </Button>
    </div>
  )
}
