import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientAuth } from '../api/client'
import { t } from '../i18n/clientTranslations'

export default function ClientLogin() {
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
      const data = await clientAuth.login(email, password)
      sessionStorage.setItem('clientToken', data.token)
      sessionStorage.setItem('clientUser', JSON.stringify(data.user))
      navigate('/client')
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
            <img src="/LogoSTM.png" alt="Logo" className="mx-auto h-16 w-auto object-contain mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">{t('supportPortal')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('loginSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
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
                {loading ? t('loggingIn') : t('loginButton')}
              </button>
              <button
                type="button"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {t('dashboardButton')}
              </button>
            </div>
          </form>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          Se non hai un utente chiedi al responsabile della tua azienda di crearlo.
        </p>

      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 py-4 text-center">
        <p className="text-[11px] text-gray-400">
          &copy; 2014-2026 STM Domotica Corporation S.r.l. &mdash; All rights reserved.
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          P.IVA: IT08502970968 &mdash; Sede Legale e Operativa in Largo Aldo Moro n&deg;15 &mdash; 26839 Zelo Buon Persico (LO)
        </p>
      </div>
    </div>
  )
}
