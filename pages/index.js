import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Login({ session }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) router.push('/dashboard')
  }, [session])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos.')
    else router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">GasOps</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de gestión de estaciones</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              placeholder="gerente@estacion.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
