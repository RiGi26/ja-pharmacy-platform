import { LoginForm } from './login-form'
import { Pill } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <Pill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">ja-pharmacy</h1>
          <p className="text-sm text-gray-400 mt-1">Japan Arena Corp</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Masuk ke akun</h2>
          <p className="text-sm text-gray-400 mb-6">Gunakan email & password yang diberikan admin</p>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          Japan Arena Corp · Confidential
        </p>
      </div>
    </div>
  )
}
