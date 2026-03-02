import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Headset } from 'lucide-react'
import { clientAuth } from '../api/client'

export default function ClientLogin() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Dynamic client info from slug
  const [clientInfo, setClientInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setInfoLoading(true)
    clientAuth.info(slug)
      .then(info => {
        setClientInfo(info)
        setNotFound(false)
      })
      .catch(() => setNotFound(true))
      .finally(() => setInfoLoading(false))
  }, [slug])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await clientAuth.login(email, password, slug)
      localStorage.setItem('clientToken', data.token)
      localStorage.setItem('clientUser', JSON.stringify(data.user))
      navigate(`/client/${slug}`)
    } catch (err) {
      setError(err.message || 'Errore di autenticazione')
    } finally {
      setLoading(false)
    }
  }

  if (infoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Caricamento...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
              <Headset size={32} className="text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Portale non trovato</h1>
            <p className="text-sm text-gray-500">L'indirizzo inserito non corrisponde a nessun portale cliente attivo.</p>
          </div>
        </div>
      </div>
    )
  }

  const logoUrl = clientInfo?.logo ? `/uploads/logos/${clientInfo.logo}` : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="mx-auto h-16 w-auto object-contain mb-4" />
            ) : (
              <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Headset size={32} className="text-white" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{clientInfo?.nome_azienda || 'Portale Cliente'}</h1>
            <p className="text-sm text-gray-500 mt-1">Accedi per gestire ticket e progetti</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
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
                placeholder="nome@azienda.it"
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

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-teal-600 text-white rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? 'Accesso...' : 'Accedi Ticketing/Progetti'}
              </button>
              <button
                type="button"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Dashboard Sistemi
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
