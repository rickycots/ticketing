import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Ticket, AlertTriangle, Wrench, CheckCircle, Archive, Clock, LayoutList, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { clientTickets } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'

const statoConfig = {
  in_attesa: {
    icon: AlertTriangle,
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    border: 'border-l-orange-400',
    bg: 'bg-orange-50/50',
  },
  aperto: {
    icon: Wrench,
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-l-blue-400',
    bg: '',
  },
  in_lavorazione: {
    icon: Wrench,
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-l-blue-400',
    bg: '',
  },
  risolto: {
    icon: CheckCircle,
    badge: 'bg-green-100 text-green-800 border-green-200',
    border: 'border-l-green-400',
    bg: '',
  },
  chiuso: {
    icon: Archive,
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    border: 'border-l-gray-300',
    bg: 'opacity-60',
  },
}

function getStatoLabel(stato) {
  const map = { in_attesa: 'statusWaiting', aperto: 'statusInProgress', in_lavorazione: 'statusInProgress', risolto: 'statusResolved', chiuso: 'statusClosed' }
  return t(map[stato] || 'statusInProgress')
}

function formatDuration(createdAt, closedAt) {
  const start = new Date(createdAt)
  const end = new Date(closedAt || createdAt)
  const diffMs = end - start
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    const remainHours = diffHours % 24
    return remainHours > 0 ? `${diffDays}g ${remainHours}h` : `${diffDays}g`
  }
  if (diffHours > 0) {
    const remainMins = diffMins % 60
    return remainMins > 0 ? `${diffHours}h ${remainMins}m` : `${diffHours}h`
  }
  return `${Math.max(diffMins, 1)}m`
}

export default function ClientTicketList() {
  const [ticketList, setTicketList] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('esteso')
  const [openPage, setOpenPage] = useState(1)
  const [closedPage, setClosedPage] = useState(1)
  const PAGE_SIZE = 5
  const navigate = useNavigate()
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    clientTickets.list(clienteId)
      .then(setTicketList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId])

  const openTickets = ticketList.filter(t => t.stato !== 'chiuso' && t.stato !== 'risolto')
  const closedTickets = ticketList.filter(t => t.stato === 'chiuso' || t.stato === 'risolto')

  if (loading) {
    return <div className="text-center py-12 text-gray-400">{t('loading')}</div>
  }

  return (
    <div>
    <div className={`grid grid-cols-1 ${viewMode === 'esteso' ? 'lg:grid-cols-[220px_1fr_1fr]' : 'lg:grid-cols-[220px_1fr]'} gap-6`} style={{ minHeight: 800 }}>
      {/* Sidebar: Pubblicità */}
      <aside className="hidden lg:flex flex-col gap-4">
        {/* LinkedIn Banner */}
        <a
          href="https://www.linkedin.com/company/stmdomotica"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center hover:shadow-md transition-shadow"
        >
          <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto mb-2">
            <rect width="72" height="72" rx="8" fill="#0A66C2"/>
            <path d="M20.1 30h5.8v18.4h-5.8V30zm2.9-9.3a3.4 3.4 0 110 6.8 3.4 3.4 0 010-6.8zM33.1 30h5.5v2.5h.1c.8-1.4 2.6-2.9 5.4-2.9 5.8 0 6.8 3.8 6.8 8.7v10.1h-5.7v-9c0-2.1 0-4.9-3-4.9s-3.4 2.3-3.4 4.7v9.2h-5.7V30z" fill="#fff"/>
          </svg>
          <p className="text-xs font-semibold text-gray-700 mb-1">{t('visitUs')}</p>
          <p className="text-sm font-bold text-[#0A66C2]">LinkedIn</p>
        </a>

        {/* Sito Web Banner */}
        <a
          href="https://www.stmdomotica.it"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center hover:shadow-md transition-shadow"
        >
          <img src={`${import.meta.env.BASE_URL || '/'}LogoSTM.png`} alt="STM Domotica" className="h-10 mx-auto mb-2 object-contain" />
          <p className="text-xs font-semibold text-gray-700 mb-1">{t('visitWebsite')}</p>
          <p className="text-sm font-bold text-blue-700">www.stmdomotica.it</p>
        </a>

        {/* Certificazioni Banner */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('ourCertifications')}</p>
          <div className="space-y-3">
            {/* Milestone Badge */}
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 180 80" className="w-full">
                <rect x="1" y="1" width="178" height="78" rx="8" fill="white" stroke="#00a0e3" strokeWidth="2" />
                <rect x="4" y="4" width="172" height="72" rx="6" fill="none" stroke="#00a0e3" strokeWidth="0.5" opacity="0.3" />
                <path d="M30 22 L42 36 L30 50 L18 36 Z" fill="#00a0e3" />
                <text x="52" y="34" fill="#00a0e3" fontSize="16" fontWeight="700" fontFamily="Arial">milestone</text>
                <line x1="52" y1="40" x2="155" y2="40" stroke="#00a0e3" strokeWidth="0.5" opacity="0.4" />
                <text x="52" y="52" fill="#666" fontSize="8" fontWeight="600" fontFamily="Arial" letterSpacing="1">CERTIFIED PARTNER</text>
                <g fill="#00a0e3" opacity="0.5">
                  <circle cx="140" cy="52" r="1.2" />
                  <circle cx="146" cy="52" r="1.2" />
                  <circle cx="152" cy="52" r="1.2" />
                </g>
              </svg>
            </div>
            {/* NIS2 Badge */}
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 180 80" className="w-full">
                <rect x="1" y="1" width="178" height="78" rx="8" fill="#003399" stroke="#003399" strokeWidth="2" />
                <rect x="4" y="4" width="172" height="72" rx="6" fill="none" stroke="white" strokeWidth="0.5" opacity="0.2" />
                {/* EU stars */}
                {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle, i) => {
                  const r = 14
                  const cx = 32 + r * Math.cos((angle - 90) * Math.PI / 180)
                  const cy = 36 + r * Math.sin((angle - 90) * Math.PI / 180)
                  return <circle key={i} cx={cx} cy={cy} r="1.5" fill="#FFD700" />
                })}
                <text x="32" y="40" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="Arial">NIS</text>
                <text x="45" y="34" fill="white" fontSize="9" fontWeight="700" fontFamily="Arial">2</text>
                <text x="62" y="30" fill="white" fontSize="7" fontFamily="Arial" opacity="0.9">Network &amp; Information</text>
                <text x="62" y="40" fill="white" fontSize="7" fontFamily="Arial" opacity="0.9">Systems Directive</text>
                <line x1="62" y1="46" x2="165" y2="46" stroke="white" strokeWidth="0.5" opacity="0.3" />
                <text x="62" y="57" fill="#FFD700" fontSize="9" fontWeight="700" fontFamily="Arial" letterSpacing="2">COMPLIANT</text>
                {/* Shield small */}
                <path d="M158 18 L168 22 L168 32 C168 38 158 44 158 44 C158 44 148 38 148 32 L148 22 Z" fill="none" stroke="white" strokeWidth="1" opacity="0.3" />
                <path d="M156 60 L160 62 L164 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
              </svg>
            </div>
          </div>
        </div>
      </aside>

      {/* Gestione Ticket */}
      {viewMode === 'esteso' ? (
        <>
          {/* Esteso: due colonne */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t('openTickets')}</h2>
              {/* Toggle solo sulla prima colonna */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setViewMode('esteso')} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer bg-white shadow-sm text-gray-900">
                  <LayoutList size={13} /> {t('extended')}
                </button>
                <button onClick={() => { setViewMode('compatto'); setOpenPage(1); setClosedPage(1) }} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer text-gray-500 hover:text-gray-700 transition-colors">
                  <List size={13} /> {t('compact')}
                </button>
              </div>
            </div>
            {openTickets.length === 0 ? (
              <div className="p-12 text-center">
                <Ticket size={48} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">{t('noOpenTickets')}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {openTickets.slice((openPage - 1) * PAGE_SIZE, openPage * PAGE_SIZE).map(tk => {
                    const config = statoConfig[tk.stato] || statoConfig.aperto
                    const Icon = config.icon
                    return (
                      <div key={tk.id} onClick={() => navigate(`/client/tickets/${tk.id}`)}
                        className={`bg-gray-50 rounded-xl border border-gray-200 p-5 border-l-4 ${config.border} ${config.bg} cursor-pointer hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-400">{tk.codice}</span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
                                <Icon size={12} />{getStatoLabel(tk.stato)}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 truncate">{tk.oggetto}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {tk.categoria} &middot; {t('priority')}: {tk.priorita} &middot; {new Date(tk.updated_at).toLocaleDateString(getDateLocale())}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {openTickets.length > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => setOpenPage(p => Math.max(1, p - 1))} disabled={openPage === 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.ceil(openTickets.length / PAGE_SIZE) }, (_, i) => (
                      <button key={i} onClick={() => setOpenPage(i + 1)}
                        className={`w-7 h-7 rounded text-xs font-medium cursor-pointer transition-colors ${openPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setOpenPage(p => Math.min(Math.ceil(openTickets.length / PAGE_SIZE), p + 1))}
                      disabled={openPage >= Math.ceil(openTickets.length / PAGE_SIZE)}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t('closedTickets')}</h2>
            </div>
            {closedTickets.length === 0 ? (
              <div className="p-12 text-center">
                <Archive size={48} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">{t('noClosedTickets')}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {closedTickets.slice((closedPage - 1) * PAGE_SIZE, closedPage * PAGE_SIZE).map(tk => {
                    const config = statoConfig[tk.stato] || statoConfig.chiuso
                    const Icon = config.icon
                    return (
                      <div key={tk.id} className={`bg-gray-50 rounded-xl border border-gray-200 p-5 border-l-4 ${config.border} ${config.bg}`}>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/client/tickets/${tk.id}`)}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-400">{tk.codice}</span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
                                <Icon size={12} />{getStatoLabel(tk.stato)}
                              </span>
                              <span className="text-xs text-gray-400 ml-auto">{formatDuration(tk.created_at, tk.updated_at)}</span>
                            </div>
                            <h3 className="font-semibold text-gray-900 truncate">{tk.oggetto}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {tk.categoria} &middot; {new Date(tk.updated_at).toLocaleDateString(getDateLocale())}
                            </p>
                          </div>
                        </div>
                        <Link to={`/client/tickets/${tk.id}?reopen=true`}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-2 inline-block">
                          {t('reopenTicket')}
                        </Link>
                      </div>
                    )
                  })}
                </div>
                {closedTickets.length > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => setClosedPage(p => Math.max(1, p - 1))} disabled={closedPage === 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.ceil(closedTickets.length / PAGE_SIZE) }, (_, i) => (
                      <button key={i} onClick={() => setClosedPage(i + 1)}
                        className={`w-7 h-7 rounded text-xs font-medium cursor-pointer transition-colors ${closedPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setClosedPage(p => Math.min(Math.ceil(closedTickets.length / PAGE_SIZE), p + 1))}
                      disabled={closedPage >= Math.ceil(closedTickets.length / PAGE_SIZE)}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        /* Compatto: colonna singola con aperti sopra, chiusi sotto */
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t('ticketManagement')}</h2>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => { setViewMode('esteso'); setOpenPage(1); setClosedPage(1) }} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer text-gray-500 hover:text-gray-700 transition-colors">
                  <LayoutList size={13} /> {t('extended')}
                </button>
                <button onClick={() => setViewMode('compatto')} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer bg-white shadow-sm text-gray-900">
                  <List size={13} /> {t('compact')}
                </button>
              </div>
            </div>

            {/* Ticket Aperti */}
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{t('openTickets')} ({openTickets.length})</h3>
            {openTickets.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm mb-4">{t('noOpenTickets')}</div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2">{t('code')}</th>
                        <th className="px-3 py-2">{t('subject')}</th>
                        <th className="px-3 py-2">{t('status')}</th>
                        <th className="px-3 py-2 hidden sm:table-cell">{t('category')}</th>
                        <th className="px-3 py-2 hidden md:table-cell">{t('created')}</th>
                        <th className="px-3 py-2 hidden md:table-cell">{t('updated')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {openTickets.slice((openPage - 1) * PAGE_SIZE, openPage * PAGE_SIZE).map(tk => {
                        const config = statoConfig[tk.stato] || statoConfig.aperto
                        const Icon = config.icon
                        return (
                          <tr key={tk.id} onClick={() => navigate(`/client/tickets/${tk.id}`)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors">
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{tk.codice}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 truncate max-w-[200px]">{tk.oggetto}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.badge}`}>
                                <Icon size={10} />{getStatoLabel(tk.stato)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">{tk.categoria}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">{new Date(tk.created_at).toLocaleDateString(getDateLocale())}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">{new Date(tk.updated_at).toLocaleDateString(getDateLocale())}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {openTickets.length > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button onClick={() => setOpenPage(p => Math.max(1, p - 1))} disabled={openPage === 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.ceil(openTickets.length / PAGE_SIZE) }, (_, i) => (
                      <button key={i} onClick={() => setOpenPage(i + 1)}
                        className={`w-7 h-7 rounded text-xs font-medium cursor-pointer transition-colors ${openPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setOpenPage(p => Math.min(Math.ceil(openTickets.length / PAGE_SIZE), p + 1))}
                      disabled={openPage >= Math.ceil(openTickets.length / PAGE_SIZE)}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Separatore */}
            <hr className="my-5 border-gray-200" />

            {/* Ticket Chiusi */}
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{t('closedTickets')} ({closedTickets.length})</h3>
            {closedTickets.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">{t('noClosedTickets')}</div>
            ) : (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2">{t('code')}</th>
                        <th className="px-3 py-2">{t('subject')}</th>
                        <th className="px-3 py-2">{t('status')}</th>
                        <th className="px-3 py-2 hidden sm:table-cell">{t('category')}</th>
                        <th className="px-3 py-2 hidden md:table-cell">{t('created')}</th>
                        <th className="px-3 py-2 hidden md:table-cell">{t('duration')}</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {closedTickets.slice((closedPage - 1) * PAGE_SIZE, closedPage * PAGE_SIZE).map(tk => {
                        const config = statoConfig[tk.stato] || statoConfig.chiuso
                        const Icon = config.icon
                        return (
                          <tr key={tk.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap cursor-pointer" onClick={() => navigate(`/client/tickets/${tk.id}`)}>{tk.codice}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 truncate max-w-[200px] cursor-pointer" onClick={() => navigate(`/client/tickets/${tk.id}`)}>{tk.oggetto}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.badge}`}>
                                <Icon size={10} />{getStatoLabel(tk.stato)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">{tk.categoria}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">{new Date(tk.created_at).toLocaleDateString(getDateLocale())}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">{formatDuration(tk.created_at, tk.updated_at)}</td>
                            <td className="px-3 py-2.5">
                              <Link to={`/client/tickets/${tk.id}?reopen=true`}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">
                                {t('reopen')}
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {closedTickets.length > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button onClick={() => setClosedPage(p => Math.max(1, p - 1))} disabled={closedPage === 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.ceil(closedTickets.length / PAGE_SIZE) }, (_, i) => (
                      <button key={i} onClick={() => setClosedPage(i + 1)}
                        className={`w-7 h-7 rounded text-xs font-medium cursor-pointer transition-colors ${closedPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setClosedPage(p => Math.min(Math.ceil(closedTickets.length / PAGE_SIZE), p + 1))}
                      disabled={closedPage >= Math.ceil(closedTickets.length / PAGE_SIZE)}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
