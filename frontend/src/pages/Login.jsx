import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../api/client'
import { APP_VERSION } from '../version'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await auth.login(email, password)
      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))
      sessionStorage.setItem('lastLoginTime', new Date().toISOString())
      navigate('/admin')
    } catch (err) {
      setError(err.message || 'Errore di autenticazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Ticketing</h1>
            <p className="text-sm text-gray-500 mt-1">Accedi al pannello di gestione</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 whitespace-pre-line">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="admin@ticketing.local"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">Credenziali demo:</p>
            <p className="text-xs text-gray-500 text-center mt-1">
              admin@ticketing.local / admin123
            </p>
          </div>
        </div>

        <p className="text-center mt-4">
          <Link to="/client/login" className="text-sm text-blue-600 hover:underline">
            Accedi al Portale Cliente
          </Link>
        </p>

        <p className="text-center mt-6 text-[11px] text-gray-400">
          {APP_VERSION} &mdash; &copy; {new Date().getFullYear()} STM Domotica Corporation S.r.l.
        </p>
      </div>
    </div>
  )
}
