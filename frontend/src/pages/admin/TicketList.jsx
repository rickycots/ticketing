import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, BookOpen } from 'lucide-react'
import { tickets, clients as clientsApi, users } from '../../api/client'
import Pagination from '../../components/Pagination'
import HelpTip from '../../components/HelpTip'
import TicketListGuide from '../../components/guides/TicketListGuide'

const prioritaColors = {
  urgente: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-yellow-100 text-yellow-800',
  bassa: 'bg-gray-100 text-gray-600',
}

const statoDotColors = {
  aperto: 'bg-blue-500',
  in_lavorazione: 'bg-yellow-500',
  in_attesa: 'bg-orange-500',
  risolto: 'bg-green-500',
  chiuso: 'bg-gray-400',
}

const statoLabels = {
  aperto: 'Aperto',
  in_lavorazione: 'In lavorazione',
  in_attesa: 'In attesa',
  risolto: 'Risolto da STM',
  chiuso: 'Chiuso dal Cliente',
}

export default function TicketList() {
  const [ticketList, setTicketList] = useState([])
  const [showGuide, setShowGuide] = useState(false)
  const [clientList, setClientList] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ stato: [], priorita: '', cliente_id: '', assegnato_a: '', search: '' })
  const [anno, setAnno] = useState(new Date().getFullYear())
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 })
  const [statoCounts, setStatoCounts] = useState({})
  const [totalAll, setTotalAll] = useState(0)
  const [sortCol, setSortCol] = useState('updated_at')
  const [sortDir, setSortDir] = useState('desc')
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
    const params = { page, limit: 10, anno }
    Object.entries(filters).forEach(([k, v]) => {
      if (k === 'stato') { if (v.length > 0) params[k] = v.join(',') }
      else if (v) params[k] = v
    })
    tickets.list(params).then(res => {
      setTicketList(res.data)
      setPagination({ total: res.total, totalPages: res.totalPages, limit: res.limit })
      if (res.statoCounts) setStatoCounts(res.statoCounts)
      if (res.totalAll !== undefined) setTotalAll(res.totalAll)
    }).catch(console.error).finally(() => setLoading(false))
  }, [filters, page, anno])

  function handleFilterChange(key, value) {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  function toggleStatoFilter(stato) {
    setFilters(f => ({ ...f, stato: f.stato.includes(stato) ? f.stato.filter(s => s !== stato) : [...f.stato, stato] }))
    setPage(1)
  }

  const tecnici = userList.filter(u => (u.ruolo === 'tecnico' || u.ruolo === 'admin') && u.attivo)

  const ticketClients = !isAdmin ? [...new Map(ticketList.filter(t => t.cliente_nome).map(t => [t.cliente_id, { id: t.cliente_id, nome_azienda: t.cliente_nome }])).values()] : []
  const displayClients = isAdmin ? clientList : ticketClients

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '\u2014'
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'ora'
    if (diffMin < 60) return `${diffMin}m fa`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h fa`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}g fa`
    return d.toLocaleDateString('it-IT')
  }

  function pct(stato) {
    if (!totalAll) return '0%'
    return Math.round(((statoCounts[stato] || 0) / totalAll) * 100) + '%'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">{isAdmin ? 'Tickets' : 'Ticket a te assegnati'} <HelpTip text="Gestione ticket di assistenza. I pallini colorati indicano lo stato. Clicca su uno stato per filtrare. La SLA indica i tempi di reazione contrattualizzati col cliente. Solo il cliente può chiudere un ticket; il tecnico può impostare Risolto." /></h1>
        <button
          onClick={() => setShowGuide(true)}
          className="ml-auto inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50 cursor-pointer"
          title="Guida visuale alla pagina"
        >
          <BookOpen size={16} /> Guida
        </button>
      </div>
      <TicketListGuide open={showGuide} onClose={() => setShowGuide(false)} />

      {/* Quick filters + Clickable legend with percentages */}
      <div className="flex flex-wrap items-center gap-1.5 lg:gap-3 mb-4">
        <button
          onClick={() => { setFilters(f => ({ ...f, stato: [] })); setPage(1) }}
          className={`px-2 lg:px-3 py-1 lg:py-1.5 rounded-full text-[10px] lg:text-xs font-medium cursor-pointer transition-colors ${
            filters.stato.length === 0
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tutti <span className="font-bold">{totalAll}</span>
        </button>
        <span className="text-gray-300 hidden lg:inline">|</span>
          {Object.entries(statoLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleStatoFilter(key)}
              className={`inline-flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 py-1 rounded-full text-[10px] lg:text-xs font-medium cursor-pointer transition-colors ${
                filters.stato.includes(key)
                  ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span className={`w-2 lg:w-2.5 h-2 lg:h-2.5 rounded-full ${statoDotColors[key]}`} />
              <span className="hidden lg:inline">{label}</span> <span className="text-gray-400 hidden lg:inline">({pct(key)})</span>
            </button>
          ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
          <div className="relative md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per codice, oggetto, testo..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
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
        ) : ticketList.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nessun ticket trovato per il {anno}</div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="lg:hidden divide-y divide-gray-100">
              {[...ticketList].sort((a, b) => {
                const dir = sortDir === 'asc' ? 1 : -1
                const va = a[sortCol], vb = b[sortCol]
                if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1
                if (typeof va === 'string') return va.localeCompare(vb) * dir
                return (va > vb ? 1 : va < vb ? -1 : 0) * dir
              }).map(t => (
                <Link key={t.id} to={`/admin/tickets/${t.id}`}
                  className={`block p-3 hover:bg-gray-50 transition-colors ${t.stato === 'chiuso' ? 'bg-gray-100/80' : t.stato === 'risolto' ? 'bg-green-100/60' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statoDotColors[t.stato] || 'bg-gray-400'}`} />
                      <span className="text-xs font-mono text-gray-400">{t.codice}</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${prioritaColors[t.priorita]}`}>{t.priorita}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{t.oggetto}</p>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
                    <span>{t.cliente_nome}</span>
                    <span>{formatTimeAgo(t.updated_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop table view */}
            <table className="w-full hidden lg:table">
              <thead>
                {(() => {
                  const SortTh = ({ col, children, extra }) => (
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 cursor-pointer hover:text-gray-700 transition-colors select-none"
                      onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc') } }}>
                      <span className="inline-flex items-center gap-1">
                        {children}
                        {sortCol === col ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={10} className="text-gray-300" />}
                        {extra}
                      </span>
                    </th>
                  )
                  return (
                <tr className="border-b border-gray-200 bg-gray-50">
                  <SortTh col="codice">Codice</SortTh>
                  <SortTh col="oggetto">Oggetto</SortTh>
                  <SortTh col="cliente_nome">Cliente (SLA)</SortTh>
                  <SortTh col="priorita">Priorita</SortTh>
                  <SortTh col="assegnato_nome">Assegnato</SortTh>
                  <SortTh col="created_at">Data</SortTh>
                  <SortTh col="updated_at" extra={<HelpTip size={12} text="Ultima modifica al ticket (cambio stato, risposta, assegnazione). Mostra il tempo trascorso dall'ultimo aggiornamento." />}>Updated</SortTh>
                  <SortTh col="data_evasione" extra={<HelpTip size={12} text="Data in cui il ticket è stato risolto. Verde = risolto entro i tempi SLA del cliente. Rosso = risolto oltre i tempi SLA. Grigio = ticket chiuso dal cliente. Il trattino indica che il ticket non è ancora stato risolto." />}>Evasione</SortTh>
                </tr>
                  )
                })()}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...ticketList].sort((a, b) => {
                  const dir = sortDir === 'asc' ? 1 : -1
                  const va = a[sortCol], vb = b[sortCol]
                  if (va == null && vb == null) return 0
                  if (va == null) return 1
                  if (vb == null) return -1
                  if (typeof va === 'string') return va.localeCompare(vb) * dir
                  return (va > vb ? 1 : va < vb ? -1 : 0) * dir
                }).map(t => (
                  <tr key={t.id} className={`hover:bg-gray-100 transition-colors ${t.stato === 'chiuso' ? 'bg-gray-100/80' : t.stato === 'risolto' ? 'bg-green-100/60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link to={`/admin/tickets/${t.id}`} className="text-sm font-mono text-blue-600 hover:underline">
                        {t.codice}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statoDotColors[t.stato] || 'bg-gray-400'}`} title={statoLabels[t.stato]} />
                        <Link to={`/admin/tickets/${t.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                          {t.oggetto}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.cliente_nome} {(() => {
                        const sla = t.sla_reazione === '1g' ? '1g' : t.sla_reazione === '3g' ? '3g' : null
                        return sla
                          ? <span className="text-red-600 font-bold">({sla})</span>
                          : <span className="text-gray-400">(-)</span>
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[t.priorita]}`}>
                        {t.priorita}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.assegnato_nome || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(t.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500" title={t.updated_at ? new Date(t.updated_at).toLocaleString('it-IT') : ''}>
                      {formatTimeAgo(t.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t.data_evasione ? (() => {
                        const ev = new Date(t.data_evasione + 'T00:00:00')
                        const created = new Date(t.created_at)
                        const slaDays = t.sla_reazione === '1g' ? 1 : t.sla_reazione === '3g' ? 3 : null
                        const isClosed = t.stato === 'chiuso'
                        let color = 'text-gray-400'
                        if (!isClosed && slaDays) {
                          const diffMs = ev.getTime() - created.getTime()
                          const diffDays = diffMs / (1000 * 60 * 60 * 24)
                          color = diffDays > slaDays ? 'text-red-600 font-bold' : 'text-green-600'
                        } else if (!isClosed) {
                          color = 'text-green-600'
                        }
                        return <span className={color}>{ev.toLocaleDateString('it-IT')}</span>
                      })() : <span className="text-gray-300">{'\u2014'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </>
        )}

        {/* Footer: always visible — Pagination + Year navigator */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-200">
          <p className="text-sm text-gray-500 hidden lg:block">
            {pagination.total > 0 ? <>Mostra <span className="font-medium">{Math.min((page - 1) * 10 + 1, pagination.total)}</span>-<span className="font-medium">{Math.min(page * 10, pagination.total)}</span> di <span className="font-medium">{pagination.total}</span></> : <span>0 ticket</span>}
          </p>

          {/* Year navigator */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setAnno(a => a - 1); setPage(1) }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-center">{anno}</span>
            <button onClick={() => { setAnno(a => a + 1); setPage(1) }} disabled={anno >= new Date().getFullYear()} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Page navigator */}
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.max(1, pagination.totalPages) }, (_, i) => i + 1).slice(
              Math.max(0, page - 3), Math.min(pagination.totalPages, page + 2)
            ).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded-lg text-sm font-medium cursor-pointer ${p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
