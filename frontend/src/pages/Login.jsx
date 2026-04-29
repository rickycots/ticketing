import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../api/client'
import { APP_VERSION } from '../version'
import { ShieldCheck } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()

  // Clear stale session on mount — prevents 401 race condition
  useEffect(() => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePwdError, setChangePwdError] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  // 2FA state
  const [show2fa, setShow2fa] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [tfaCode, setTfaCode] = useState('')
  const [tfaError, setTfaError] = useState('')
  const [tfaVerifying, setTfaVerifying] = useState(false)
  const [pendingUserData, setPendingUserData] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Clear any stale session before login
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')

    try {
      const data = await auth.login(email, password)

      // 2FA required
      if (data.require_2fa) {
        setTempToken(data.temp_token)
        setPendingUserData(data.user)
        setShow2fa(true)
        setTfaCode('')
        setTfaError('')
        setLoading(false)
        return
      }

      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))
      sessionStorage.setItem('lastLoginTime', new Date().toISOString())

      if (data.user.cambio_password) {
        setShowChangePassword(true)
      } else {
        navigate('/admin')
      }
    } catch (err) {
      setError('Accesso Negato — Verifica i dati')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2fa(e) {
    e.preventDefault()
    setTfaError('')
    setTfaVerifying(true)

    try {
      const data = await auth.verify2fa(tempToken, tfaCode)
      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(pendingUserData))
      sessionStorage.setItem('lastLoginTime', new Date().toISOString())
      setShow2fa(false)

      if (pendingUserData.cambio_password) {
        setShowChangePassword(true)
      } else {
        navigate('/admin')
      }
    } catch (err) {
      if (err.locked) {
        setShow2fa(false)
        setError(err.message || 'Troppi tentativi errati. Effettua nuovamente il login.')
      } else {
        const remaining = err.remaining
        setTfaError(
          remaining !== undefined
            ? `Codice ERRATO — ${remaining} ${remaining === 1 ? 'tentativo rimasto' : 'tentativi rimasti'}`
            : (err.message || 'Errore di verifica')
        )
      }
      setTfaCode('')
    } finally {
      setTfaVerifying(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setChangePwdError('')

    if (newPassword.length < 6) {
      setChangePwdError('La password deve avere almeno 6 caratteri')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangePwdError('Le password non corrispondono')
      return
    }

    setChangingPwd(true)
    try {
      await auth.changePassword(newPassword)
      const user = JSON.parse(sessionStorage.getItem('user') || '{}')
      user.cambio_password = 0
      sessionStorage.setItem('user', JSON.stringify(user))
      navigate('/admin')
    } catch (err) {
      setChangePwdError(err.message || 'Errore nel cambio password')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Ticketing</h1>
            <p className="text-sm text-gray-500 mt-1">
              {showChangePassword ? 'Cambio password richiesto' : 'Accedi al pannello di gestione'}
            </p>
          </div>

          {showChangePassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {changePwdError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {changePwdError}
                </div>
              )}
              <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg border border-amber-200">
                È richiesto il cambio password al primo accesso
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuova Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Minimo 6 caratteri"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conferma Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Ripeti la password"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={changingPwd}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {changingPwd ? 'Salvataggio...' : 'Cambia Password'}
              </button>
            </form>
          ) : (
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
                  placeholder="email@stmdomotica.it"
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
          )}

          {!showChangePassword && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-green-600 text-center font-medium">Sito Operativo</p>
            </div>
          )}
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

      {show2fa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 rounded-lg p-2">
                <ShieldCheck size={22} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Verifica in due passaggi</h3>
                <p className="text-xs text-gray-500">Abbiamo inviato un codice alla tua email</p>
              </div>
            </div>

            <form onSubmit={handleVerify2fa} className="space-y-4">
              {tfaError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 font-medium">
                  {tfaError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice di verifica</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="000000"
                  required
                  autoFocus
                />
              </div>

              <p className="text-xs text-gray-400">Il codice scade tra 10 minuti</p>

              <button
                type="submit"
                disabled={tfaVerifying || tfaCode.length !== 6}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {tfaVerifying ? 'Verifica in corso...' : 'Verifica Codice'}
              </button>

              <button
                type="button"
                onClick={() => { setShow2fa(false); setTempToken(''); setPendingUserData(null) }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Torna al login
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
