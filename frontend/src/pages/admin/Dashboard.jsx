import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, FolderKanban, Mail, AlertTriangle, Clock, Users } from 'lucide-react'
import { dashboard } from '../../api/client'
import { APP_VERSION } from '../../version'

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  )

  return to ? <Link to={to}>{content}</Link> : content
}

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

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    dashboard.get().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  }

  if (!data) return null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4 mb-8`}>
        <StatCard
          icon={Ticket}
          label="Ticket Aperti"
          value={data.ticket_aperti}
          color="bg-blue-500"
          to="/admin/tickets"
        />
        {isAdmin && (
          <StatCard
            icon={FolderKanban}
            label="Progetti Attivi"
            value={data.progetti_attivi}
            sub={`${data.progetti_blocco_cliente} bloccati lato cliente`}
            color="bg-purple-500"
            to="/admin/projects"
          />
        )}
        {isAdmin && (
          <StatCard
            icon={Mail}
            label="Email Non Lette"
            value={data.email_non_lette}
            color="bg-green-500"
            to="/admin/emails"
          />
        )}
        <StatCard
          icon={Clock}
          label="Scadenze (7gg)"
          value={data.scadenze_imminenti.length}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="text-lg font-semibold">Ticket Urgenti / Alta Priorità</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.ticket_urgenti.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Nessun ticket urgente</p>
            ) : (
              data.ticket_urgenti.map(t => (
                <Link
                  key={t.id}
                  to={`/admin/tickets/${t.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{t.oggetto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.codice}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioritaColors[t.priorita]}`}>
                      {t.priorita}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[t.stato]}`}>
                      {t.stato.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Ticket size={18} className="text-blue-500" />
            <h2 className="text-lg font-semibold">Ticket Recenti</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.ticket_recenti.map(t => (
              <Link
                key={t.id}
                to={`/admin/tickets/${t.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{t.oggetto}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.codice} — {t.cliente_nome}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[t.stato]}`}>
                  {t.stato.replace('_', ' ')}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            <h2 className="text-lg font-semibold">Scadenze Imminenti</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.scadenze_imminenti.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Nessuna scadenza nei prossimi 7 giorni</p>
            ) : (
              data.scadenze_imminenti.map(a => (
                <div key={a.id} className="p-4">
                  <p className="text-sm font-medium">{a.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.progetto_nome} — Scadenza: {new Date(a.data_scadenza).toLocaleDateString('it-IT')}
                  </p>
                  {a.assegnato_nome && (
                    <p className="text-xs text-gray-400">Assegnato a: {a.assegnato_nome}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workload per technician (admin only) */}
        {isAdmin && <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Users size={18} className="text-purple-500" />
            <h2 className="text-lg font-semibold">Carico per Tecnico</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.carico_tecnici.map(u => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <p className="text-sm font-medium">{u.nome}</p>
                <div className="flex gap-3 text-xs">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    {u.ticket_attivi} ticket
                  </span>
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                    {u.attivita_attive} attività
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>}
      </div>

      {/* Version footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        {APP_VERSION} &mdash; &copy; {new Date().getFullYear()} STM Domotica Corporation S.r.l.
      </div>
    </div>
  )
}
