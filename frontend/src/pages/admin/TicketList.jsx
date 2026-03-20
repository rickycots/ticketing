import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, Building2 } from 'lucide-react'
import { tickets, clients as clientsApi, users } from '../../api/client'
import Pagination from '../../components/Pagination'

const prioritaColors = {
  urgente: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-yellow-100 text-yellow-800',
  bassa: 'bg-gray-100 text-gray-600',
}

const statoColors = {
  aperto: 'bg-blue-100 text-blue-800',
  in_lavorazione: 'bg-yellow-100 text-yellow-800',
  in_attesa: 'bg-orange-100 text-orange-800',
  risolto: 'bg-green-100 text-green-800',
  chiuso: 'bg-gray-100 text-gray-600',
}

const statoLabels = {
  aperto: 'Aperto',
  in_lavorazione: 'In lavorazione',
  in_attesa: 'In attesa',
  risolto: 'Risolto',
  chiuso: 'Chiuso',
}

export default function TicketList() {
  const [ticketList, setTicketList] = useState([])
  const [clientList, setClientList] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ stato: '', priorita: '', cliente_id: '', assegnato_a: '', search: '' })
  const [quickFilter, setQuickFilter] = useState('aperti')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 })
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  useEffect(() => {
    if (isAdmin) {
      clientsApi.list({ limit: 1000 }).then(res => setClientList(res.data || [])).catch(() => {})
      users.list().then(setUserList).catch(console.error)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = { page }
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    tickets.list(params).then(res => {
      setTicketList(res.data)
      setPagination({ total: res.total, totalPages: res.totalPages, limit: res.limit })
    }).catch(console.error).finally(() => setLoading(false))
  }, [filters, page])

  function handleFilterChange(key, value) {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const tecnici = userList.filter(u => (u.ruolo === 'tecnico' || u.ruolo === 'admin') && u.attivo)

  // For tecnico: extract unique clients from their ticket list
  const ticketClients = !isAdmin ? [...new Map(ticketList.filter(t => t.cliente_nome).map(t => [t.cliente_id, { id: t.cliente_id, nome_azienda: t.cliente_nome }])).values()] : []
  const displayClients = isAdmin ? clientList : ticketClients

  const filteredTickets = quickFilter === 'tutti' ? ticketList
    : quickFilter === 'aperti' ? ticketList.filter(t => ['aperto', 'in_lavorazione', 'in_attesa'].includes(t.stato))
    : ticketList.filter(t => ['risolto', 'chiuso'].includes(t.stato))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <div className="flex items-center gap-2">
          {[{ label: 'Aperti', value: 'aperti' }, { label: 'Chiusi', value: 'chiusi' }, { label: 'Tutti', value: 'tutti' }].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setQuickFilter(opt.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                quickFilter === opt.value
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtri</span>
        </div>
        <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca ticket..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={filters.stato}
            onChange={(e) => handleFilterChange('stato', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tutti gli stati</option>
            {Object.entries(statoLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={filters.priorita}
            onChange={(e) => handleFilterChange('priorita', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tutte le priorita</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="bassa">Bassa</option>
          </select>
          {displayClients.length > 0 && (
            <select
              value={filters.cliente_id}
              onChange={(e) => handleFilterChange('cliente_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tutti i clienti</option>
              {displayClients.map(c => (
                <option key={c.id} value={c.id}>{c.nome_azienda}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <select
              value={filters.assegnato_a}
              onChange={(e) => handleFilterChange('assegnato_a', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tutti gli assegnati</option>
              {tecnici.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Client filter banner */}
      {filters.cliente_id && (() => {
        const cl = clientList.find(c => String(c.id) === String(filters.cliente_id))
        return cl ? (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-teal-600" />
            </div>
            <span className="text-sm font-bold text-teal-900">{cl.nome_azienda}</span>
          </div>
        ) : null
      })()}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nessun ticket trovato</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Codice</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Oggetto</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Priorita</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stato</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Assegnato</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Data</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Evasione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTickets.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/admin/tickets/${t.id}`} className="text-sm font-mono text-blue-600 hover:underline">
                        {t.codice}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/tickets/${t.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                        {t.oggetto}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.cliente_nome}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[t.priorita]}`}>
                        {t.priorita}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[t.stato]}`}>
                          {statoLabels[t.stato]}
                        </span>
                        {t.assegnato_nome && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold" title={t.assegnato_nome}>
                            {t.assegnato_nome.split(' ').map(p => p[0]).join('').toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.assegnato_nome || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(t.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t.data_evasione ? (() => {
                        const ev = new Date(t.data_evasione + 'T00:00:00');
                        const today = new Date(); today.setHours(0,0,0,0);
                        const diffMs = ev.getTime() - today.getTime();
                        const diffDays = diffMs / (1000 * 60 * 60 * 24);
                        const color = diffDays < 0 ? 'text-red-600 font-bold' : diffDays <= 1 ? 'text-orange-500 font-medium' : 'text-gray-500';
                        return <span className={color}>{ev.toLocaleDateString('it-IT')}</span>
                      })() : <span className="text-gray-300">{'\u2014'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
