import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, Ticket, FolderKanban } from 'lucide-react'
import { clients } from '../../api/client'
import Pagination from '../../components/Pagination'

export default function ClientList() {
  const [clientList, setClientList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome_azienda: '', referente: '', email: '', telefono: '', indirizzo: '', citta: '', provincia: '', sla_reazione: 'nb', note: '' })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 })
  const navigate = useNavigate()

  function loadClients() {
    setLoading(true)
    clients.list({ page }).then(res => {
      setClientList(res.data)
      setPagination({ total: res.total, totalPages: res.totalPages, limit: res.limit })
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadClients() }, [page])

  async function handleCreate(e) {
    e.preventDefault()
    await clients.create(form)
    setForm({ nome_azienda: '', referente: '', email: '', telefono: '', indirizzo: '', citta: '', provincia: '', sla_reazione: 'nb', note: '' })
    setShowForm(false)
    loadClients()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clienti</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Nuovo Cliente
        </button>
      </div>

      {/* New Client Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Azienda *</label>
                <input
                  type="text"
                  value={form.nome_azienda}
                  onChange={(e) => setForm(f => ({ ...f, nome_azienda: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referente Commerciale</label>
                <input
                  type="text"
                  value={form.referente}
                  onChange={(e) => setForm(f => ({ ...f, referente: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Referente Commerciale *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                <input
                  type="text"
                  value={form.indirizzo}
                  onChange={(e) => setForm(f => ({ ...f, indirizzo: e.target.value }))}
                  placeholder="Via/Piazza..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                  <input
                    type="text"
                    value={form.citta}
                    onChange={(e) => setForm(f => ({ ...f, citta: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <input
                    type="text"
                    value={form.provincia}
                    onChange={(e) => setForm(f => ({ ...f, provincia: e.target.value }))}
                    maxLength={2}
                    placeholder="es. MI"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SLA Reazione</label>
              <select
                value={form.sla_reazione}
                onChange={(e) => setForm(f => ({ ...f, sla_reazione: e.target.value }))}
                className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
              >
                <option value="nb">NB (nessun vincolo)</option>
                <option value="1g">1 giorno</option>
                <option value="3g">3 giorni</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
                Crea Cliente
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Client Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : clientList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nessun cliente trovato</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientList.map(c => (
            <div key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{c.nome_azienda}</h3>
                  {c.referente && <p className="text-sm text-gray-500">{c.referente}</p>}
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-600 mb-4">
                <p>{c.email}</p>
                {c.telefono && <p>{c.telefono}</p>}
                {(c.citta || c.provincia) && (
                  <p className="text-gray-400">{[c.citta, c.provincia].filter(Boolean).join(' (') + (c.provincia ? ')' : '')}</p>
                )}
              </div>

              {c.note && (
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{c.note}</p>
              )}

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Ticket size={14} />
                  <span>{c.num_ticket} ticket</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <FolderKanban size={14} />
                  <span>{c.num_progetti} progetti</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
