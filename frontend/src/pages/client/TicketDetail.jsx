import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, AlertTriangle, Wrench, CheckCircle, Archive } from 'lucide-react'
import { clientTickets } from '../../api/client'

const statoConfig = {
  in_attesa: { label: 'In attesa di tuo riscontro', badge: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  aperto: { label: 'Aperto', badge: 'bg-blue-100 text-blue-800', icon: Wrench },
  in_lavorazione: { label: 'In lavorazione', badge: 'bg-blue-100 text-blue-800', icon: Wrench },
  risolto: { label: 'Risolto', badge: 'bg-green-100 text-green-800', icon: CheckCircle },
  chiuso: { label: 'Chiuso', badge: 'bg-gray-100 text-gray-600', icon: Archive },
}

export default function ClientTicketDetail() {
  const { id, slug } = useParams()
  const clientUser = JSON.parse(localStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!clienteId) return
    clientTickets.get(clienteId, id)
      .then(setTicket)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId, id])

  async function handleReply(e) {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    try {
      const updated = await clientTickets.reply(clienteId, id, reply)
      setTicket(updated)
      setReply('')
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  }

  if (!ticket) {
    return <div className="text-center text-gray-400 py-12">Ticket non trovato</div>
  }

  const config = statoConfig[ticket.stato] || statoConfig.aperto
  const StatusIcon = config.icon
  const canReply = ticket.stato !== 'chiuso' && ticket.stato !== 'risolto'

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/client/${slug}/tickets`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        Torna ai ticket
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-mono text-gray-400">{ticket.codice}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
            <StatusIcon size={12} />
            {config.label}
          </span>
        </div>
        <h1 className="text-xl font-bold">{ticket.oggetto}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {ticket.categoria} &middot; Priorità: {ticket.priorita} &middot; Aperto il {new Date(ticket.created_at).toLocaleDateString('it-IT')}
        </p>
      </div>

      {/* Thread */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold">Conversazione</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {ticket.emails && ticket.emails.length > 0 ? (
            ticket.emails.map(e => {
              const isAdmin = e.mittente === 'admin@ticketing.local'
              return (
                <div key={e.id} className={`p-4 ${isAdmin ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-medium ${isAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                      {isAdmin ? 'Assistenza' : 'Tu'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(e.data_ricezione).toLocaleString('it-IT')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{e.corpo}</p>
                </div>
              )
            })
          ) : (
            <div className="p-6 text-center text-gray-400 text-sm">Nessun messaggio</div>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {canReply ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <form onSubmit={handleReply}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Scrivi la tua risposta..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
                {sending ? 'Invio...' : 'Invia Risposta'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500">
          Questo ticket è {ticket.stato === 'chiuso' ? 'chiuso' : 'risolto'} e non accetta nuove risposte.
        </div>
      )}
    </div>
  )
}
