import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Ticket, FolderKanban, Mail, Clock, PieChart, ChevronLeft, ChevronRight } from 'lucide-react'
import { dashboard } from '../../api/client'

const statoColors = {
  aperto: 'bg-blue-100 text-blue-800',
  in_lavorazione: 'bg-yellow-100 text-yellow-800',
  in_attesa: 'bg-orange-100 text-orange-800',
  risolto: 'bg-green-100 text-green-800',
  chiuso: 'bg-gray-100 text-gray-600',
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

const prioritaColors = {
  urgente: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-yellow-100 text-yellow-800',
  bassa: 'bg-gray-100 text-gray-600',
}

function MiniPie({ segments, size = 120 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="20" />
        <text x="60" y="64" textAnchor="middle" className="text-lg font-bold fill-gray-400">0</text>
      </svg>
    )
  }
  let cumulative = 0
  const radius = 50
  const circumference = 2 * Math.PI * radius

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {segments.map((seg, i) => {
        const pct = seg.value / total
        const offset = cumulative * circumference
        cumulative += pct
        return (
          <circle
            key={i}
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="20"
            strokeDasharray={`${pct * circumference} ${circumference}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        )
      })}
      <text x="60" y="64" textAnchor="middle" className="text-lg font-bold fill-gray-700">{total}</text>
    </svg>
  )
}

function StatBox({ icon: Icon, title, color, titleLink, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        {titleLink ? (
          <Link to={titleLink} className="text-sm font-semibold text-blue-600 hover:underline">{title}</Link>
        ) : (
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        )}
      </div>
      {children}
    </div>
  )
}

export default function ClientDashboard() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ticketAnno, setTicketAnno] = useState(new Date().getFullYear())
  const [ticketPage, setTicketPage] = useState(1)
  const [statoFilter, setStatoFilter] = useState('')

  useEffect(() => {
    dashboard.client(id).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12 text-gray-400">Caricamento...</div>
  if (!data) return <div className="text-center py-12 text-gray-400">Dati non disponibili</div>

  const { cliente, ticket, tempo_medio_ticket, email, progetti, tempo_medio_attivita, ticket_recenti } = data

  return (
    <div>
      <Link to={`/admin/clients/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Torna al cliente
      </Link>

      <h1 className="text-2xl font-bold mb-4">Dashboard Cliente</h1>

      {/* Client Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
          <Building2 size={16} className="text-teal-600" />
        </div>
        <span className="text-sm font-bold text-teal-900">Cliente: {cliente.nome_azienda}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">

        {/* Ticket Pie */}
        <StatBox icon={Ticket} title="Ticket" color="bg-blue-500">
          <div className="flex items-center gap-4">
            <MiniPie segments={[
              { value: ticket.aperti, color: '#3b82f6' },
              { value: ticket.chiusi, color: '#22c55e' },
            ]} />
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                <span>Aperti: <strong>{ticket.aperti}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>Chiusi: <strong>{ticket.chiusi}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Totali: {ticket.totali} &middot; N.MedioMsg: <strong>{ticket.media_messaggi || 0}</strong></div>
            </div>
          </div>
        </StatBox>

        {/* Tempo medio ticket */}
        <StatBox icon={Clock} title="Tempo Medio Gestione Ticket" color="bg-orange-500">
          <div className="flex flex-col items-center justify-center h-24">
            <p className="text-3xl font-bold text-gray-800">
              {tempo_medio_ticket !== null ? `${tempo_medio_ticket}` : '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tempo_medio_ticket !== null ? 'giorni' : 'Nessun ticket chiuso'}
            </p>
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 text-sm text-gray-500 text-center">
            SLA assegnata: <strong>{cliente.sla_reazione === '1g' ? '1 giorno' : cliente.sla_reazione === '3g' ? '3 giorni' : cliente.sla_reazione === 'nb' ? 'Next Business' : 'Nessuna'}</strong>
          </div>
        </StatBox>

        {/* Email Pie */}
        <StatBox icon={Mail} title="Email Gestite" color="bg-green-500">
          <div className="flex items-center gap-4">
            <MiniPie segments={[
              { value: email.assegnate, color: '#22c55e' },
              { value: email.non_assegnate, color: '#d1d5db' },
            ]} />
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>Assegnate: <strong>{email.assegnate}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
                <span>Non assegnate: <strong>{email.non_assegnate}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Totali: {email.totali}</div>
            </div>
          </div>
        </StatBox>

        {/* Progetti Pie */}
        <StatBox icon={FolderKanban} title="Progetti" color="bg-purple-500" titleLink={`/admin/timeline?cliente=${id}`}>
          <div className="flex items-center gap-4">
            <MiniPie segments={[
              { value: progetti.attivi, color: '#3b82f6' },
              { value: progetti.chiusi, color: '#22c55e' },
              { value: progetti.bloccati, color: '#ef4444' },
              { value: progetti.senza_attivita, color: '#9ca3af' },
            ]} />
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                <span>Attivi: <strong>{progetti.attivi}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>Chiusi: <strong>{progetti.chiusi}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                <span>Bloccati: <strong>{progetti.bloccati}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
                <span>Senza att.: <strong>{progetti.senza_attivita}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Totali: {progetti.totali}</div>
            </div>
          </div>
        </StatBox>

        {/* Tempo medio attivita */}
        <StatBox icon={Clock} title="Tempo Medio Durata Attivita" color="bg-indigo-500">
          <div className="flex flex-col items-center justify-center h-24">
            <p className="text-3xl font-bold text-gray-800">
              {tempo_medio_attivita !== null ? `${tempo_medio_attivita}` : '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tempo_medio_attivita !== null ? 'giorni' : 'Nessuna attivita completata'}
            </p>
          </div>
        </StatBox>
      </div>

      {/* Recent tickets */}
      {(() => {
        const LIMIT = 10
        const filtered = ticket_recenti.filter(t => new Date(t.created_at).getFullYear() === ticketAnno)
        const filteredByStato = statoFilter ? filtered.filter(t => t.stato === statoFilter) : filtered
        const totalPages = Math.max(1, Math.ceil(filteredByStato.length / LIMIT))
        const displayTickets = filteredByStato.slice((ticketPage - 1) * LIMIT, ticketPage * LIMIT)

        // Stato counts for this year
        const counts = {}
        let totalAll = 0
        filtered.forEach(t => { counts[t.stato] = (counts[t.stato] || 0) + 1; totalAll++ })
        const pct = (stato) => totalAll ? Math.round(((counts[stato] || 0) / totalAll) * 100) + '%' : '0%'

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
          return d.toLocaleDateString('it-IT')
        }

        return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Ticket size={18} className="text-blue-500" />
            <h2 className="text-lg font-semibold">Ticket</h2>
          </div>

          {/* Stato filter pills */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
            <button onClick={() => { setStatoFilter(''); setTicketPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${!statoFilter ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tutti <span className="font-bold">{totalAll}</span>
            </button>
            <span className="text-gray-300">|</span>
            {Object.entries(statoLabels).map(([key, label]) => (
              <button key={key} onClick={() => { setStatoFilter(statoFilter === key ? '' : key); setTicketPage(1) }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  statoFilter === key ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${statoDotColors[key]}`} />
                {label} <span className="text-gray-400">({pct(key)})</span>
              </button>
            ))}
          </div>

          {displayTickets.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nessun ticket per il {ticketAnno}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Codice</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Oggetto</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Priorita</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Assegnato</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Data</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Updated</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Evasione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayTickets.map(t => (
                  <tr key={t.id} className={`hover:bg-gray-100 transition-colors ${t.stato === 'chiuso' ? 'bg-gray-100/80' : t.stato === 'risolto' ? 'bg-green-100/60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link to={`/admin/tickets/${t.id}`} className="text-sm font-mono text-blue-600 hover:underline">{t.codice}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statoDotColors[t.stato] || 'bg-gray-400'}`} title={statoLabels[t.stato]} />
                        <Link to={`/admin/tickets/${t.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">{t.oggetto}</Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[t.priorita]}`}>{t.priorita}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.assegnato_nome || '\u2014'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{new Date(t.created_at).toLocaleDateString('it-IT')}</td>
                    <td className="px-4 py-3 text-xs text-gray-500" title={t.updated_at ? new Date(t.updated_at).toLocaleString('it-IT') : ''}>{formatTimeAgo(t.updated_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {t.data_evasione ? (() => {
                        const ev = new Date(t.data_evasione + 'T00:00:00')
                        const isClosed = t.stato === 'chiuso'
                        const created = new Date(t.created_at)
                        const slaDays = t.sla_reazione === '1g' ? 1 : t.sla_reazione === '3g' ? 3 : null
                        let color = 'text-gray-400'
                        if (!isClosed && slaDays) {
                          const diffDays = (ev.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
                          color = diffDays > slaDays ? 'text-red-600 font-bold' : 'text-green-600'
                        } else if (!isClosed) { color = 'text-green-600' }
                        return <span className={color}>{ev.toLocaleDateString('it-IT')}</span>
                      })() : <span className="text-gray-300">{'\u2014'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Footer: Pagination + Year */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {filtered.length > 0 ? <>Mostra <span className="font-medium">{Math.min((ticketPage - 1) * LIMIT + 1, filtered.length)}</span>-<span className="font-medium">{Math.min(ticketPage * LIMIT, filtered.length)}</span> di <span className="font-medium">{filtered.length}</span></> : <span>0 ticket</span>}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => { setTicketAnno(a => a - 1); setTicketPage(1) }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"><ChevronLeft size={16} /></button>
              <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-center">{ticketAnno}</span>
              <button onClick={() => { setTicketAnno(a => a + 1); setTicketPage(1) }} disabled={ticketAnno >= new Date().getFullYear()} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight size={16} /></button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setTicketPage(p => p - 1)} disabled={ticketPage <= 1} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronLeft size={16} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, ticketPage - 3), Math.min(totalPages, ticketPage + 2)).map(p => (
                <button key={p} onClick={() => setTicketPage(p)} className={`px-2.5 py-1 rounded-lg text-sm font-medium cursor-pointer ${p === ticketPage ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
              <button onClick={() => setTicketPage(p => p + 1)} disabled={ticketPage >= totalPages} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
