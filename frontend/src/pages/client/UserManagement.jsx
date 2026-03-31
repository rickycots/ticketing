import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import { clientUsers } from '../../api/client'
import { t } from '../../i18n/clientTranslations'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({ nome: '', email: '', password: '', schede_visibili: 'ticket,progetti,ai', lingua: 'it', cambio_password: 1, two_factor: 0 })
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
      setForm({ nome: user.nome, email: user.email, password: '', schede_visibili: user.schede_visibili, lingua: user.lingua || 'it', cambio_password: user.cambio_password ?? 1, two_factor: user.two_factor ?? 0 })
    } else {
      setEditingUser(null)
      setForm({ nome: '', email: '', password: '', schede_visibili: 'ticket,progetti,ai', lingua: 'it', cambio_password: 1, two_factor: 0 })
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UserCircle size={24} className="text-blue-600" />
          {t('userManagement')}
        </h1>
        <button onClick={() => openForm()} className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
          <Plus size={16} /> {t('newUser')}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <h2 className="text-sm font-semibold mb-3">{editingUser ? t('editUser') : t('newUser')}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')} *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')} *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser ? t('passwordUnchanged') : '*'}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value, ...(editingUser && e.target.value ? { cambio_password: 1 } : {}) }))} required={!editingUser} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                <select value={form.lingua} onChange={e => setForm(f => ({ ...f, lingua: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="it">Italiano</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
            <div className="flex gap-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('visibleSections')}</label>
                <div className="flex flex-col gap-2">
                  {[['ticket', 'Ticket', 'servizio_ticket'], ['progetti', 'Progetti', 'servizio_progetti'], ['ai', 'AI Assistant', 'servizio_ai']].map(([key, label, srv]) => {
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('securityOptions') || 'Opzioni Sicurezza'}</label>
                <div className="flex flex-col gap-2">
                  <label className={`inline-flex items-center gap-2 text-sm ${editingUser && !form.cambio_password && !form.password ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={!!form.cambio_password} onChange={() => setForm(f => ({ ...f, cambio_password: f.cambio_password ? 0 : 1 }))} disabled={editingUser && !form.cambio_password && !form.password} className="rounded border-gray-300" />
                    {t('forcePasswordChange') || 'Consenti cambio password al primo avvio'}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form.two_factor} onChange={() => setForm(f => ({ ...f, two_factor: f.two_factor ? 0 : 1 }))} className="rounded border-gray-300" />
                    {t('twoFactorAuth') || 'Utilizza autenticazione a 2 fattori'}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {saving ? t('saving') : editingUser ? t('update') : t('createUser')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingUser(null) }} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                {t('cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{t('loading')}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('noUsers')}</div>
        ) : (
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 font-medium w-[18%]">{t('name')}</th>
                <th className="px-3 py-2.5 font-medium w-[25%]">{t('email')}</th>
                <th className="px-3 py-2.5 font-medium w-[18%]">{t('sections')}</th>
                <th className="px-3 py-2.5 font-medium w-[8%] text-center">2FA</th>
                <th className="px-3 py-2.5 font-medium w-[10%] text-center">{t('active')}</th>
                <th className="px-3 py-2.5 font-medium w-[10%]">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => {
                const isMe = u.id === currentUser.id
                const isAdmin = u.ruolo === 'admin'
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900 truncate">
                      {u.nome}
                      {isMe && <span className="ml-1 text-xs text-blue-500">{t('youLabel')}</span>}
                      {isAdmin && <span className="ml-1 text-xs text-purple-500">Admin</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 truncate">{u.email}</td>
                    <td className="px-3 py-2.5">
                      {isAdmin ? (
                        <span className="text-xs text-gray-400">{t('all')}</span>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {u.schede_visibili.split(',').map(s => (
                            <span key={s} className="bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5 text-[11px] font-medium">
                              {s === 'ticket' ? 'Ticket' : s === 'progetti' ? 'Progetti' : 'AI'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-medium ${!!u.two_factor ? 'text-green-600' : 'text-gray-400'}`}>{!!u.two_factor ? 'SI' : 'NO'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
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
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => openForm(u)} className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                          <Pencil size={14} />
                        </button>
                        {!isMe && (
                          <button onClick={() => handleDelete(u.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
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
