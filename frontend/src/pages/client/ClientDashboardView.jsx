import { useState, useEffect } from 'react'
import { Ticket, FolderKanban, Mail, Clock } from 'lucide-react'
import { clientAuth } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'

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

function StatBox({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function ClientDashboardView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clientAuth.dashboard().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-400">{t('loading')}</div>
  if (!data) return <div className="text-center py-12 text-gray-400">-</div>

  const { ticket, tempo_medio_ticket, email, progetti, tempo_medio_attivita, ticket_recenti } = data

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">{t('dashboard')}</h1>

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
                <span>{t('openTickets')}: <strong>{ticket.aperti}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>{t('closedTickets')}: <strong>{ticket.chiusi}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-1">{t('dashboardTotal')}: {ticket.totali}</div>
            </div>
          </div>
        </StatBox>

        {/* Tempo medio ticket */}
        <StatBox icon={Clock} title={t('dashboardAvgTicket')} color="bg-orange-500">
          <div className="flex flex-col items-center justify-center h-24">
            <p className="text-3xl font-bold text-gray-800">
              {tempo_medio_ticket !== null ? `${tempo_medio_ticket}` : '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tempo_medio_ticket !== null ? t('dashboardDays') : t('dashboardNoClosedTickets')}
            </p>
          </div>
        </StatBox>

        {/* Email Pie */}
        <StatBox icon={Mail} title={t('dashboardEmails')} color="bg-green-500">
          <div className="flex items-center gap-4">
            <MiniPie segments={[
              { value: email.assegnate, color: '#22c55e' },
              { value: email.non_assegnate, color: '#d1d5db' },
            ]} />
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>{t('dashboardAssigned')}: <strong>{email.assegnate}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
                <span>{t('dashboardUnassigned')}: <strong>{email.non_assegnate}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-1">{t('dashboardTotal')}: {email.totali}</div>
            </div>
          </div>
        </StatBox>

        {/* Progetti Pie */}
        <StatBox icon={FolderKanban} title={t('myProjects')} color="bg-purple-500">
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
                <span>{t('active')}: <strong>{progetti.attivi}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span>{t('dashboardClosed')}: <strong>{progetti.chiusi}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                <span>{t('actBlocked')}: <strong>{progetti.bloccati}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
                <span>{t('dashboardNoActivities')}: <strong>{progetti.senza_attivita}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-1">{t('dashboardTotal')}: {progetti.totali}</div>
            </div>
          </div>
        </StatBox>

        {/* Tempo medio attivita */}
        <StatBox icon={Clock} title={t('dashboardAvgActivity')} color="bg-indigo-500">
          <div className="flex flex-col items-center justify-center h-24">
            <p className="text-3xl font-bold text-gray-800">
              {tempo_medio_attivita !== null ? `${tempo_medio_attivita}` : '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tempo_medio_attivita !== null ? t('dashboardDays') : t('dashboardNoCompletedAct')}
            </p>
          </div>
        </StatBox>
      </div>

      {/* Recent tickets */}
      {ticket_recenti.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Ticket size={18} className="text-blue-500" />
            <h2 className="text-lg font-semibold">{t('dashboardRecentTickets')}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {ticket_recenti.map(tk => (
              <div key={tk.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{tk.oggetto}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tk.codice} - {new Date(tk.created_at).toLocaleDateString(getDateLocale())}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[tk.priorita] || ''}`}>
                    {tk.priorita}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[tk.stato] || ''}`}>
                    {tk.stato.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
