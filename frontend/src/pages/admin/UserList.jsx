import { useState, useEffect } from 'react'
import { Plus, UserCog } from 'lucide-react'
import { users } from '../../api/client'

export default function UserList() {
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', password: '' })
  const [error, setError] = useState('')

  function loadUsers() {
    setLoading(true)
    users.list().then(setUserList).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      await users.create(form)
      setForm({ nome: '', email: '', password: '' })
      setShowForm(false)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleActive(user) {
    await users.update(user.id, { attivo: user.attivo ? 0 : 1 })
    loadUsers()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Utenti</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Nuovo Tecnico
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Il ruolo sarà automaticamente impostato a "Tecnico"</p>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
                Crea Tecnico
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError('') }} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : userList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nessun utente trovato</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userList.map(u => (
            <div key={u.id} className={`bg-white rounded-xl border shadow-sm p-5 ${u.attivo ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg ${u.ruolo === 'admin' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                  <UserCog size={20} className={u.ruolo === 'admin' ? 'text-purple-600' : 'text-blue-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{u.nome}</h3>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  u.ruolo === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {u.ruolo}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className={`text-xs font-medium ${u.attivo ? 'text-green-600' : 'text-gray-400'}`}>
                  {u.attivo ? 'Attivo' : 'Disattivato'}
                </span>
                {u.ruolo !== 'admin' && (
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`text-xs px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                      u.attivo
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {u.attivo ? 'Disattiva' : 'Attiva'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
