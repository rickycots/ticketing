import { useState } from 'react'
import { KeyRound, Eye, EyeOff, X } from 'lucide-react'
import { auth, clientAuth } from '../api/client'

export default function ChangePasswordModal({ mode = 'admin', onClose, labels = {} }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const L = {
    title: labels.title || 'Cambio Password',
    subtitle: labels.subtitle || 'Aggiorna la tua password di accesso',
    oldLabel: labels.oldLabel || 'Password attuale',
    newLabel: labels.newLabel || 'Nuova password',
    confirmLabel: labels.confirmLabel || 'Conferma nuova password',
    placeholder: labels.placeholder || '••••••••',
    requirements: labels.requirements || 'Minimo 6 caratteri',
    save: labels.save || 'Cambia Password',
    saving: labels.saving || 'Salvataggio...',
    cancel: labels.cancel || 'Annulla',
    successMsg: labels.successMsg || 'Password aggiornata con successo',
    minLengthErr: labels.minLengthErr || 'La password deve avere almeno 6 caratteri',
    mismatchErr: labels.mismatchErr || 'Le password non corrispondono',
    sameAsOldErr: labels.sameAsOldErr || 'La nuova password deve essere diversa da quella attuale',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) { setError(L.minLengthErr); return }
    if (newPassword !== confirmPassword) { setError(L.mismatchErr); return }
    if (oldPassword && oldPassword === newPassword) { setError(L.sameAsOldErr); return }

    setSaving(true)
    try {
      if (mode === 'client') {
        await clientAuth.changePassword(newPassword, oldPassword)
      } else {
        await auth.changePassword(newPassword, oldPassword)
      }
      setSuccess(L.successMsg)
      setOldPassword(''); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => { onClose && onClose() }, 1200)
    } catch (err) {
      setError(err.message || 'Errore nel cambio password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 rounded-lg p-2">
              <KeyRound size={22} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{L.title}</h3>
              <p className="text-xs text-gray-500">{L.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg border border-red-200">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg border border-green-200">{success}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.oldLabel}</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={L.placeholder}
                required
                autoFocus
              />
              <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.newLabel}</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={L.placeholder}
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.confirmLabel}</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={L.placeholder}
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">{L.requirements}</p>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors cursor-pointer">
              {saving ? L.saving : L.save}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 cursor-pointer">{L.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
