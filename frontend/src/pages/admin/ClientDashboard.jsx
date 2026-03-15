import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Ticket, FolderKanban, Mail, Clock, PieChart } from 'lucide-react'
import { dashboard } from '../../api/client'

const statoColors = {
  aperto: 'bg-blue-100 text-blue-800',
  in_lavorazione: 'bg-yellow-100 text-yellow-800',
  in_attesa: 'bg-orange-100 text-orange-800',
  risolto: 'bg-green-100 text-green-800',
  chiuso: 'bg-gray-100 text-gray-600',
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
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-teal-900">{cliente.nome_azienda}</h2>
            <div className="flex gap-4 text-sm text-teal-700">
              {cliente.email && <span>{cliente.email}</span>}
              {cliente.telefono && <span>{cliente.telefono}</span>}
              {cliente.referente && <span>Ref: {cliente.referente}</span>}
            </div>
          </div>
        </div>
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
              <div className="text-xs text-gray-400 mt-1">Totali: {ticket.totali}</div>
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
      {ticket_recenti.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Ticket size={18} className="text-blue-500" />
            <h2 className="text-lg font-semibold">Ticket Recenti</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {ticket_recenti.map(t => (
              <Link key={t.id} to={`/admin/tickets/${t.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{t.oggetto}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.codice} - {new Date(t.created_at).toLocaleDateString('it-IT')}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[t.priorita] || ''}`}>
                    {t.priorita}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[t.stato] || ''}`}>
                    {t.stato.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
