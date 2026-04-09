import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, UserCircle, X } from 'lucide-react'
import { clientUsers } from '../../api/client'
import { t } from '../../i18n/clientTranslations'
import HelpTip from '../../components/HelpTip'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({ nome: '', cognome: '', email: '', password: '', schede_visibili: 'ticket,progetti,ai', lingua: 'it', cambio_password: 1, two_factor: 0 })
  const [saving, setSaving] = useState(false)
  const currentUser = JSON.parse(sessionStorage.getItem('clientUser') || '{}')

  useEffect(() => { loadUsers() }, [])

  function loadUsers() {
    setLoading(true)
    clientUsers.list().then(setUsers).catch(console.error).finally(() => setLoading(false))
  }

  function openForm(user = null) {
    if (user) {
      setEditingUser(user)
      setForm({ nome: user.nome, cognome: user.cognome || '', email: user.email, password: '', schede_visibili: user.schede_visibili, lingua: user.lingua || 'it', cambio_password: Number(user.cambio_password) || 0, two_factor: Number(user.two_factor) || 0 })
    } else {
      setEditingUser(null)
      setForm({ nome: '', cognome: '', email: '', password: '', schede_visibili: 'ticket,progetti,ai', lingua: 'it', cambio_password: 1, two_factor: 0 })
    }
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingUser) {
        const data = { ...form }
        if (!data.password) delete data.password
        await clientUsers.update(editingUser.id, data)
        // If editing self, update sessionStorage with new lingua
        if (editingUser.id === currentUser.id && form.lingua !== currentUser.lingua) {
          const updated = { ...currentUser, lingua: form.lingua }
          sessionStorage.setItem('clientUser', JSON.stringify(updated))
          window.location.reload()
        }
      } else {
        await clientUsers.create(form)
      }
      setShowForm(false)
      setEditingUser(null)
      loadUsers()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(userId) {
    if (!confirm(t('confirmDeleteUser'))) return
    try { await clientUsers.delete(userId); loadUsers() } catch (err) { alert(err.message) }
  }

  async function handleToggleActive(user) {
    try {
      await clientUsers.update(user.id, { attivo: user.attivo ? 0 : 1 })
      loadUsers()
    } catch (err) { alert(err.message) }
  }

  function toggleScheda(scheda) {
    const current = form.schede_visibili.split(',').filter(Boolean)
    const updated = current.includes(scheda)
      ? current.filter(s => s !== scheda)
      : [...current, scheda]
    setForm(f => ({ ...f, schede_visibili: updated.join(',') || 'ticket' }))
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCircle size={24} className="text-blue-600" />
          {t('userManagement')}
        </h1>
        <button onClick={() => openForm()} className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
          <Plus size={16} /> {t('newUser')}
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowForm(false); setEditingUser(null) }}>
        <div className="bg-white rounded-xl shadow-2xl w-full p-6 relative" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { setShowForm(false); setEditingUser(null) }} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{editingUser ? t('editUser') : t('newUser')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')} *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                <input type="text" value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')} *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser ? '(vuoto = invariata)' : '*'}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value, ...(editingUser && e.target.value ? { cambio_password: 1 } : {}) }))} required={!editingUser} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                  <input type="text" value="User" disabled className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                  <select value={form.lingua} onChange={e => setForm(f => ({ ...f, lingua: e.target.value }))} className={inputCls}>
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">{t('visibleSections')} <HelpTip size={12} text="Le voci in grigio sono servizi disattivati a livello azienda. Contatta l'amministratore per attivarli." /></label>
                <div className="flex flex-col gap-2">
                  {[['ticket', 'Ticket', 'servizio_ticket'], ['progetti', 'Progetti', 'servizio_progetti'], ['ai', 'AI Assistant', 'servizio_ai'], ['progetti_stm', 'Progetti STM', 'servizio_progetti_stm']].map(([key, label, srv]) => {
                    const attivo = !!currentUser[srv]
                    return (
                      <label key={key} className={`inline-flex items-center gap-2 text-sm ${!attivo ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={form.schede_visibili.includes(key)} onChange={() => toggleScheda(key)} disabled={!attivo} className="rounded border-gray-300" />
                        {label} {!attivo && <span className="text-[10px] text-red-400">(non attivo)</span>}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('securityOptions') || 'Opzioni Password'}</label>
                <div className="flex flex-col gap-2">
                  <label className={`inline-flex items-center gap-2 text-sm ${editingUser && !form.cambio_password && !form.password ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={!!form.cambio_password} onChange={() => setForm(f => ({ ...f, cambio_password: f.cambio_password ? 0 : 1 }))} disabled={editingUser && !form.cambio_password && !form.password} className="rounded border-gray-300" />
                    Cambio password al primo avvio
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form.two_factor} onChange={() => setForm(f => ({ ...f, two_factor: f.two_factor ? 0 : 1 }))} className="rounded border-gray-300" />
                    Autenticazione a 2 fattori
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingUser(null) }} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {saving ? t('saving') : editingUser ? t('update') : t('createUser')}
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{t('loading')}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('noUsers')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium">{t('name')}</th>
                <th className="px-4 py-3 font-medium">{t('email')}</th>
                <th className="px-4 py-3 font-medium">{t('sections')}</th>
                <th className="px-4 py-3 font-medium text-center">2FA</th>
                <th className="px-4 py-3 font-medium text-center">{t('active')}</th>
                <th className="px-4 py-3 font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const isMe = u.id === currentUser.id
                const isAdmin = u.ruolo === 'admin'
                return (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.attivo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.nome} {u.cognome || ''}
                      {isMe && <span className="ml-1.5 text-xs text-blue-500">{t('youLabel')}</span>}
                      {isAdmin && <span className="ml-1.5 text-xs text-purple-500">Admin</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <span className="text-xs text-gray-400">{t('all')}</span>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {u.schede_visibili.split(',').map(s => (
                            <span key={s} className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
                              {s === 'ticket' ? 'Ticket' : s === 'progetti' ? 'Progetti' : 'AI'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${!!u.two_factor ? 'text-green-600' : 'text-gray-400'}`}>{!!u.two_factor ? 'SI' : 'NO'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!isMe ? (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${u.attivo ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${u.attivo ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                      ) : (
                        <span className="text-xs text-green-600">{t('active')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openForm(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                          <Pencil size={14} />
                        </button>
                        {!isMe && (
                          <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
