import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientAuth } from '../api/client'
import { t } from '../i18n/clientTranslations'
import { APP_VERSION } from '../version'
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function ClientLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 2FA modal state
  const [show2fa, setShow2fa] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [tfaCode, setTfaCode] = useState('')
  const [tfaError, setTfaError] = useState('')
  const [tfaVerifying, setTfaVerifying] = useState(false)
  const [pendingUserData, setPendingUserData] = useState(null)

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [changePwdError, setChangePwdError] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await clientAuth.login(email, password)

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

      sessionStorage.setItem('clientToken', data.token)
      sessionStorage.setItem('clientUser', JSON.stringify(data.user))

      // Check if password change is required
      if (data.user.cambio_password) {
        setShowChangePassword(true)
      } else {
        navigate('/client')
      }
    } catch (err) {
      setError(err.message || 'Errore di autenticazione')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2fa(e) {
    e.preventDefault()
    setTfaError('')
    setTfaVerifying(true)

    try {
      const data = await clientAuth.verify2fa(tempToken, tfaCode)

      // 2FA verified — store token and user data
      sessionStorage.setItem('clientToken', data.token)
      sessionStorage.setItem('clientUser', JSON.stringify(pendingUserData))
      setShow2fa(false)

      // Check if password change is required
      if (pendingUserData.cambio_password) {
        setShowChangePassword(true)
      } else {
        navigate('/client')
      }
    } catch (err) {
      if (err.locked) {
        // 3 failed attempts — back to login
        setShow2fa(false)
        setError(err.message || 'Troppi tentativi errati. Effettua nuovamente il login.')
      } else {
        const remaining = err.remaining
        setTfaError(
          remaining !== undefined
            ? `${t('codeWrong') || 'Codice ERRATO'} — ${remaining} ${remaining === 1 ? (t('attemptLeft') || 'tentativo rimasto') : (t('attemptsLeft') || 'tentativi rimasti')}`
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
      setChangePwdError(t('passwordMinLength') || 'La password deve avere almeno 6 caratteri')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangePwdError(t('passwordMismatch') || 'Le password non corrispondono')
      return
    }

    setChangingPwd(true)
    try {
      await clientAuth.changePassword(newPassword)
      // Update session data
      const user = JSON.parse(sessionStorage.getItem('clientUser') || '{}')
      user.cambio_password = 0
      sessionStorage.setItem('clientUser', JSON.stringify(user))
      navigate('/client')
    } catch (err) {
      setChangePwdError(err.message || 'Errore nel cambio password')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: `url('${import.meta.env.BASE_URL || '/'}sfondo1.jpg')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <img src={`${import.meta.env.BASE_URL || '/'}LogoSTM.png`} alt="Logo" className="mx-auto h-16 w-auto object-contain mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">{t('supportPortal')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('loginSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 whitespace-pre-line">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? t('loggingIn') : t('loginButton')}
            </button>
          </form>
        </div>
        <p className="text-xs text-white/80 text-center mt-4 leading-relaxed">
          Se non hai un utente chiedi al responsabile della tua azienda di crearlo.
        </p>

      </div>

      {/* 2FA Verification Modal */}
      {show2fa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 rounded-lg p-2">
                <ShieldCheck size={22} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('twoFactorTitle') || 'Verifica in due passaggi'}</h3>
                <p className="text-xs text-gray-500">{t('twoFactorSubtitle') || 'Abbiamo inviato un codice alla tua email'}</p>
              </div>
            </div>

            <form onSubmit={handleVerify2fa} className="space-y-4">
              {tfaError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 font-medium">
                  {tfaError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('verificationCode') || 'Codice di verifica'}</label>
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

              <p className="text-xs text-gray-400">{t('codeExpiry') || 'Il codice scade tra 10 minuti'}</p>

              <button
                type="submit"
                disabled={tfaVerifying || tfaCode.length !== 6}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {tfaVerifying ? (t('verifying') || 'Verifica in corso...') : (t('verifyButton') || 'Verifica Codice')}
              </button>

              <button
                type="button"
                onClick={() => { setShow2fa(false); setTempToken(''); setPendingUserData(null) }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                {t('backToLogin') || 'Torna al login'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 rounded-lg p-2">
                <KeyRound size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('changePasswordTitle') || 'Cambio Password'}</h3>
                <p className="text-xs text-gray-500">{t('changePasswordSubtitle') || 'È richiesto il cambio password al primo accesso'}</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {changePwdError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {changePwdError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('newPassword') || 'Nuova Password'}</label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                    {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('confirmPassword') || 'Conferma Password'}</label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowConfirmPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                    {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400">{t('passwordRequirements') || 'Minimo 6 caratteri'}</p>

              <button
                type="submit"
                disabled={changingPwd}
                className="w-full bg-amber-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {changingPwd ? (t('saving') || 'Salvataggio...') : (t('changePasswordButton') || 'Cambia Password')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 py-4 text-center">
        <p className="text-[11px] text-white/70">
          &copy; 2014-2026 STM Domotica Corporation S.r.l. &mdash; All rights reserved.
        </p>
        <p className="text-[10px] text-white/60 mt-0.5">
          P.IVA: IT08502970968 &mdash; Sede Legale e Operativa in Largo Aldo Moro n&deg;15 &mdash; 26839 Zelo Buon Persico (LO)
        </p>
        <p className="text-[10px] text-white/50 mt-1">{APP_VERSION}</p>
      </div>
    </div>
  )
}
