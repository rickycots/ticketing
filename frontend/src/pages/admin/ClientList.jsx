import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Building2, Ticket, FolderKanban, BarChart3, LayoutList, List } from 'lucide-react'
import { clients } from '../../api/client'
import Pagination from '../../components/Pagination'

export default function ClientList() {
  const [clientList, setClientList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome_azienda: '', referente: '', email: '', telefono: '', indirizzo: '', citta: '', provincia: '', sla_reazione: 'nb', note: '', servizio_ticket: true, servizio_progetti: true, servizio_ai: true })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 })
  const [viewMode, setViewMode] = useState('esteso')
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
    await clients.create({ ...form, servizio_ticket: form.servizio_ticket ? 1 : 0, servizio_progetti: form.servizio_progetti ? 1 : 0, servizio_ai: form.servizio_ai ? 1 : 0 })
    setForm({ nome_azienda: '', referente: '', email: '', telefono: '', indirizzo: '', citta: '', provincia: '', sla_reazione: 'nb', note: '', servizio_ticket: true, servizio_progetti: true, servizio_ai: true })
    setShowForm(false)
    loadClients()
  }

  const slaLabel = (sla) => sla === '1g' ? '1g' : sla === '3g' ? '3g' : 'NB'

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
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold shrink-0">Clienti</h1>
          <p className="text-[11px] text-gray-400 italic leading-snug">Clicca sul cliente per modificare</p>
        </div>
        <div className="flex items-center gap-3">
          {viewToggle}
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Nuovo Cliente
          </button>
        </div>
      </div>

      {/* New Client Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Azienda *</label>
                <input type="text" value={form.nome_azienda} onChange={(e) => setForm(f => ({ ...f, nome_azienda: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referente Commerciale</label>
                <input type="text" value={form.referente} onChange={(e) => setForm(f => ({ ...f, referente: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Referente Commerciale *</label>
                <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">*questa mail non è un account di accesso al sistema</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input type="text" value={form.telefono} onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                <input type="text" value={form.indirizzo} onChange={(e) => setForm(f => ({ ...f, indirizzo: e.target.value }))} placeholder="Via/Piazza..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                  <input type="text" value={form.citta} onChange={(e) => setForm(f => ({ ...f, citta: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <input type="text" value={form.provincia} onChange={(e) => setForm(f => ({ ...f, provincia: e.target.value }))} maxLength={2} placeholder="es. MI" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SLA Reazione</label>
              <select value={form.sla_reazione} onChange={(e) => setForm(f => ({ ...f, sla_reazione: e.target.value }))} className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500">
                <option value="nb">NB (nessun vincolo)</option>
                <option value="1g">1 giorno</option>
                <option value="3g">3 giorni</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Servizi attivi:</span>
                {[['servizio_ticket', 'Ticket'], ['servizio_progetti', 'Progetti'], ['servizio_ai', 'AI']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-600">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">Crea Cliente</button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">Annulla</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : clientList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nessun cliente trovato</div>
      ) : viewMode === 'esteso' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientList.map(c => {
            const serviziAttivi = [c.servizio_ticket, c.servizio_progetti, c.servizio_ai, c.servizio_progetti_stm].filter(Boolean).length
            return (
            <div key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow relative flex flex-col">
              <Link
                to={`/admin/clients/${c.id}/dashboard`}
                onClick={e => e.stopPropagation()}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Dashboard Cliente"
              >
                <BarChart3 size={16} />
              </Link>
              <h3 className="font-bold text-gray-900 text-base mb-2">{c.nome_azienda}</h3>
              <div className="space-y-1 text-sm text-gray-600 flex-1">
                <p>Referente: <span className="text-gray-500">{c.referente || '—'}</span></p>
                <p className="text-gray-400">{[c.indirizzo, c.citta, c.provincia ? `(${c.provincia})` : ''].filter(Boolean).join(', ') || '—'}</p>
                <p>Telefono: <span className="text-gray-500">{c.telefono || '—'}</span></p>
                <p className="text-xs text-gray-400 line-clamp-1">Note: {c.note || '—'}</p>
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                <div className="flex gap-3">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Ticket size={14} />
                    <span>{c.num_ticket} ticket</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FolderKanban size={14} />
                    <span>{c.num_progetti} progetti</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">Servizi Attivi <b className="text-gray-600">{serviziAttivi}/4</b></span>
              </div>
            </div>
            )
          })}
        </div>
      ) : (
        /* Vista compatta - tabella */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Azienda</th>
                <th className="px-4 py-3 hidden sm:table-cell">Referente</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 hidden md:table-cell">Città</th>
                <th className="px-4 py-3 hidden md:table-cell">SLA</th>
                <th className="px-4 py-3 text-center">Ticket</th>
                <th className="px-4 py-3 text-center">Progetti</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientList.map(c => (
                <tr key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{c.nome_azienda}</td>
                  <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell whitespace-nowrap">{c.referente || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell whitespace-nowrap">{[c.citta, c.provincia].filter(Boolean).join(' (') + (c.provincia ? ')' : '') || '—'}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.sla_reazione === '1g' ? 'bg-red-100 text-red-700' : c.sla_reazione === '3g' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                      {slaLabel(c.sla_reazione)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{c.num_ticket}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{c.num_progetti}</td>
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/clients/${c.id}/dashboard`} onClick={e => e.stopPropagation()} className="p-1 rounded text-gray-400 hover:text-indigo-600 cursor-pointer" title="Dashboard">
                      <BarChart3 size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
      </div>
    </div>
  )
}
