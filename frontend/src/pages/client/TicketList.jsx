import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ticket, ChevronLeft, ChevronRight, UserRound, Search } from 'lucide-react'
import { clientTickets } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'
import HelpTip from '../../components/HelpTip'

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
  risolto: 'Risolto',
  chiuso: 'Chiuso',
}

export default function ClientTicketList() {
  const [ticketList, setTicketList] = useState([])
  const [loading, setLoading] = useState(true)
  const [onlyMine, setOnlyMine] = useState(false)
  const [statoFilter, setStatoFilter] = useState('')
  const [search, setSearch] = useState('')
  const [anno, setAnno] = useState(new Date().getFullYear())
  const [page, setPage] = useState(1)
  const LIMIT = 10
  const navigate = useNavigate()
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id
  const myEmail = clientUser.email

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    clientTickets.list(clienteId)
      .then(setTicketList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId])

  // Filter pipeline
  let filtered = ticketList
  if (onlyMine) filtered = filtered.filter(tk => tk.creatore_email === myEmail)
  filtered = filtered.filter(tk => {
    const d = tk.created_at || ''
    return parseInt(d.substring(0, 4)) === anno
  })
  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter(tk => (tk.oggetto || '').toLowerCase().includes(s) || (tk.codice || '').toLowerCase().includes(s))
  }
  if (statoFilter) filtered = filtered.filter(tk => tk.stato === statoFilter)

  // Stato counts (before stato filter, after year+mine+search)
  let countBase = ticketList
  if (onlyMine) countBase = countBase.filter(tk => tk.creatore_email === myEmail)
  countBase = countBase.filter(tk => parseInt((tk.created_at || '').substring(0, 4)) === anno)
  if (search) { const s = search.toLowerCase(); countBase = countBase.filter(tk => (tk.oggetto || '').toLowerCase().includes(s) || (tk.codice || '').toLowerCase().includes(s)) }
  const statoCounts = {}
  let totalAll = 0
  countBase.forEach(tk => { statoCounts[tk.stato] = (statoCounts[tk.stato] || 0) + 1; totalAll++ })
  const pct = (stato) => totalAll ? Math.round(((statoCounts[stato] || 0) / totalAll) * 100) + '%' : '0%'

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT))
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT)

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '\u2014'
    const d = new Date(dateStr)
    const now = new Date()
    const diffMin = Math.floor((now - d) / 60000)
    if (diffMin < 1) return 'ora'
    if (diffMin < 60) return `${diffMin}m fa`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h fa`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}g fa`
    return d.toLocaleDateString(getDateLocale())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('ticketManagement')}</h1>
        <Link to="/client/tickets/new" className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
          <Ticket size={16} /> {t('openTicket')}
        </Link>
      </div>

      {/* Filters: Tutti + stato pills + Solo miei */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => { setStatoFilter(''); setPage(1) }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${!statoFilter ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {t('all') || 'Tutti'} <span className="font-bold">{totalAll}</span>
        </button>
        <span className="text-gray-300">|</span>
        {Object.entries(statoLabels).map(([key, label]) => (
          <button key={key} onClick={() => { setStatoFilter(statoFilter === key ? '' : key); setPage(1) }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              statoFilter === key ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${statoDotColors[key]}`} />
            {label} <span className="text-gray-400">({pct(key)})</span>
          </button>
        ))}
        <span className="text-gray-300">|</span>
        <button onClick={() => { setOnlyMine(v => !v); setPage(1) }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${onlyMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
          <UserRound size={13} /> {t('onlyMine')}
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={t('searchPlaceholder') || 'Cerca per codice o oggetto...'} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">{t('loading')}</div>
        ) : paged.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t('noOpenTickets') || 'Nessun ticket trovato'}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t('code')}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t('subject')}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t('priority') || 'Priorita'}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t('created')}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">{t('updated')}</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Evaso</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3"><span className="inline-flex items-center gap-1">Altri <HelpTip size={12} text="Numero di partecipanti al ticket. Chiunque risponda al ticket (via portale o email) diventa un partecipante e riceverà le notifiche successive." /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map(tk => (
                <tr key={tk.id} onClick={() => navigate(`/client/tickets/${tk.id}`)}
                  className={`hover:bg-gray-100 transition-colors cursor-pointer ${tk.stato === 'chiuso' ? 'bg-gray-100/80' : tk.stato === 'risolto' ? 'bg-green-100/60' : ''}`}>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">{tk.codice}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statoDotColors[tk.stato] || 'bg-gray-400'}`} title={statoLabels[tk.stato]} />
                      <span className="text-sm font-medium text-gray-900">{tk.oggetto}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[tk.priorita]}`}>
                      {tk.priorita}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(tk.created_at).toLocaleDateString(getDateLocale())}</td>
                  <td className="px-4 py-3 text-xs text-gray-500" title={tk.updated_at ? new Date(tk.updated_at).toLocaleString(getDateLocale()) : ''}>
                    {formatTimeAgo(tk.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tk.data_evasione ? (() => {
                      const ev = new Date(tk.data_evasione + 'T00:00:00')
                      const isClosed = tk.stato === 'chiuso'
                      const color = isClosed ? 'text-gray-400' : 'text-green-600'
                      return <span className={color}>{ev.toLocaleDateString(getDateLocale())}</span>
                    })() : <span className="text-gray-300">{'\u2014'}</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">
                    {tk.partecipanti_count || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer: count + year + pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            {filtered.length > 0 ? <>Mostra <span className="font-medium">{Math.min((page - 1) * LIMIT + 1, filtered.length)}</span>-<span className="font-medium">{Math.min(page * LIMIT, filtered.length)}</span> di <span className="font-medium">{filtered.length}</span></> : <span>0 ticket</span>}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => { setAnno(a => a - 1); setPage(1) }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"><ChevronLeft size={16} /></button>
            <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-center">{anno}</span>
            <button onClick={() => { setAnno(a => a + 1); setPage(1) }} disabled={anno >= new Date().getFullYear()} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronLeft size={16} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded-lg text-sm font-medium cursor-pointer ${p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
