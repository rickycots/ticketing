import { useState, useEffect } from 'react'
import { Plus, UserCog, Trash2, Pencil, X, LayoutList, List } from 'lucide-react'
import { users } from '../../api/client'

export default function UserList() {
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', password: '', cambio_password: true })
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ nome: '', email: '', password: '' })
  const [viewMode, setViewMode] = useState('esteso')

  function loadUsers() {
    setLoading(true)
    users.list().then(setUserList).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      await users.create({ ...form, cambio_password: form.cambio_password ? 1 : 0 })
      setForm({ nome: '', email: '', password: '', cambio_password: true })
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(user) {
    setEditingId(user.id)
    setEditForm({ nome: user.nome, email: user.email, password: '' })
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    try {
      const data = { nome: editForm.nome, email: editForm.email }
      if (editForm.password) data.password = editForm.password
      await users.update(editingId, data)
      setEditingId(null)
      loadUsers()
    } catch (err) { alert(err.message) }
  }

  async function handleToggleActive(user) {
    await users.update(user.id, { attivo: user.attivo ? 0 : 1 })
    loadUsers()
  }

  async function handleDelete(user) {
    if (!confirm(`Eliminare l'utente "${user.nome}"? Questa azione è irreversibile.`)) return
    try {
      await users.delete(user.id)
      loadUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  const viewToggle = (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      <button onClick={() => setViewMode('esteso')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${viewMode === 'esteso' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
        <LayoutList size={13} /> Estesa
      </button>
      <button onClick={() => setViewMode('compatto')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${viewMode === 'compatto' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
        <List size={13} /> Compatta
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Utenti</h1>
        <div className="flex items-center gap-3">
          {viewToggle}
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Nuovo Tecnico
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input type="text" value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.cambio_password} onChange={e => setForm(f => ({ ...f, cambio_password: e.target.checked }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Richiedi cambio password al primo accesso</span>
            </label>
            <p className="text-xs text-gray-500">Il ruolo sarà automaticamente impostato a "Tecnico"</p>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">Crea Tecnico</button>
              <button type="button" onClick={() => { setShowForm(false); setError('') }} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">Annulla</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : userList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nessun utente trovato</div>
      ) : viewMode === 'esteso' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userList.map(u => (
            <div key={u.id} className={`bg-white rounded-xl border shadow-sm p-5 ${u.attivo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              {editingId === u.id ? (
                <form onSubmit={handleSaveEdit} className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">Modifica utente</span>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"><X size={16} className="text-gray-400" /></button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                    <input type="text" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nuova password <span className="text-gray-400">(lascia vuoto per non cambiare)</span></label>
                    <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} minLength={6} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="••••••••" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-700 cursor-pointer">Salva</button>
                    <button type="button" onClick={() => setEditingId(null)} className="bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-200 cursor-pointer">Annulla</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${u.ruolo === 'admin' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                      <UserCog size={20} className={u.ruolo === 'admin' ? 'text-purple-600' : 'text-blue-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{u.nome}</h3>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${u.ruolo === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {u.ruolo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className={`text-xs font-medium ${u.attivo ? 'text-green-600' : 'text-gray-400'}`}>
                      {u.attivo ? 'Attivo' : 'Disattivato'}
                    </span>
                    <div className="flex items-center gap-2">
                      {u.ruolo !== 'admin' && (
                        <button onClick={() => startEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors" title="Modifica utente">
                          <Pencil size={15} />
                        </button>
                      )}
                      {u.ruolo !== 'admin' && (
                        <button onClick={() => handleToggleActive(u)} className={`text-xs px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${u.attivo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                          {u.attivo ? 'Disattiva' : 'Attiva'}
                        </button>
                      )}
                      {u.ruolo !== 'admin' && (
                        <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors" title="Elimina utente">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Vista compatta - tabella */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Ruolo</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userList.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.attivo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{u.nome}</td>
                  <td className="px-4 py-2.5 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${u.ruolo === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {u.ruolo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${u.attivo ? 'text-green-600' : 'text-gray-400'}`}>
                      {u.attivo ? 'Attivo' : 'Disattivato'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.ruolo !== 'admin' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(u)} className="p-1 rounded text-gray-400 hover:text-blue-600 cursor-pointer" title="Modifica"><Pencil size={14} /></button>
                        <button onClick={() => handleToggleActive(u)} className="p-1 rounded text-gray-400 hover:text-amber-600 cursor-pointer" title={u.attivo ? 'Disattiva' : 'Attiva'}>
                          <UserCog size={14} />
                        </button>
                        <button onClick={() => handleDelete(u)} className="p-1 rounded text-gray-400 hover:text-red-600 cursor-pointer" title="Elimina"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
