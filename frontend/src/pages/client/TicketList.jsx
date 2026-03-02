import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ticket, AlertTriangle, Wrench, CheckCircle, Archive } from 'lucide-react'
import { clientTickets } from '../../api/client'

const statoConfig = {
  in_attesa: {
    label: 'In attesa di tuo riscontro',
    icon: AlertTriangle,
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    border: 'border-l-orange-400',
    bg: 'bg-orange-50/50',
  },
  aperto: {
    label: 'In lavorazione',
    icon: Wrench,
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-l-blue-400',
    bg: '',
  },
  in_lavorazione: {
    label: 'In lavorazione',
    icon: Wrench,
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    border: 'border-l-blue-400',
    bg: '',
  },
  risolto: {
    label: 'Risolto',
    icon: CheckCircle,
    badge: 'bg-green-100 text-green-800 border-green-200',
    border: 'border-l-green-400',
    bg: '',
  },
  chiuso: {
    label: 'Chiuso',
    icon: Archive,
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    border: 'border-l-gray-300',
    bg: 'opacity-60',
  },
}

export default function ClientTicketList() {
  const [ticketList, setTicketList] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { slug } = useParams()
  const clientUser = JSON.parse(localStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    clientTickets.list(clienteId)
      .then(setTicketList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">I Miei Ticket</h2>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : ticketList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Ticket size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Nessun ticket aperto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ticketList.map(t => {
            const config = statoConfig[t.stato] || statoConfig.aperto
            const Icon = config.icon

            return (
              <div
                key={t.id}
                onClick={() => navigate(`/client/${slug}/tickets/${t.id}`)}
                className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-l-4 ${config.border} ${config.bg} cursor-pointer hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{t.codice}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
                        <Icon size={12} />
                        {config.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{t.oggetto}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {t.categoria} &middot; Priorità: {t.priorita} &middot; {new Date(t.updated_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
