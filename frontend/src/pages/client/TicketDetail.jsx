import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, AlertTriangle, Wrench, CheckCircle, Archive, FileDown, RotateCcw, XCircle } from 'lucide-react'
import { clientTickets } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'

const statoConfig = {
  in_attesa: { badge: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  aperto: { badge: 'bg-blue-100 text-blue-800', icon: Wrench },
  in_lavorazione: { badge: 'bg-blue-100 text-blue-800', icon: Wrench },
  risolto: { badge: 'bg-green-100 text-green-800', icon: CheckCircle },
  chiuso: { badge: 'bg-gray-100 text-gray-600', icon: Archive },
}

function getStatoLabel(stato) {
  const map = { in_attesa: 'statusWaiting', aperto: 'statusOpen', in_lavorazione: 'statusInProgress', risolto: 'statusResolved', chiuso: 'statusClosed' }
  return t(map[stato] || 'statusOpen')
}

export default function ClientTicketDetail() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const isReopen = searchParams.get('reopen') === 'true'
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!clienteId) return
    clientTickets.get(clienteId, id)
      .then(setTicket)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId, id])

  useEffect(() => {
    if (isReopen && !loading && ticket && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isReopen, loading, ticket])

  async function handleReply(e) {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    try {
      const updated = await clientTickets.reply(clienteId, id, reply)
      setTicket(updated)
      setReply('')
      // Remove reopen param after successful reply
      if (isReopen) {
        setSearchParams({}, { replace: true })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">{t('loading')}</div>
  }

  if (!ticket) {
    return <div className="text-center text-gray-400 py-12">{t('ticketNotFound')}</div>
  }

  const config = statoConfig[ticket.stato] || statoConfig.aperto
  const StatusIcon = config.icon
  const isClosed = ticket.stato === 'chiuso' || ticket.stato === 'risolto'
  const showReplyForm = !isClosed || isReopen

  async function handleClose() {
    if (!confirm(t('confirmCloseTicket'))) return
    try {
      const updated = await clientTickets.close(clienteId, id)
      setTicket(updated)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/client/tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        {t('backToTickets')}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-mono text-gray-400">{ticket.codice}</span>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
              <StatusIcon size={12} />
              {getStatoLabel(ticket.stato)}
            </span>
            {!isClosed && (
              <button
                onClick={handleClose}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              >
                <XCircle size={13} />
                {t('closeTicket')}
              </button>
            )}
          </div>
        </div>
        <h1 className="text-xl font-bold">{ticket.oggetto}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {ticket.categoria} &middot; {t('priority')}: {ticket.priorita} &middot; {t('openedOn')} {new Date(ticket.created_at).toLocaleDateString(getDateLocale())}
        </p>
      </div>

      {/* Thread */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold">{t('conversation')}</h2>
        </div>
        <div className="space-y-3 p-3">
          {ticket.emails && ticket.emails.length > 0 ? (
            ticket.emails.map(e => {
              const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
              const isAdmin = systemAddrs.includes(e.mittente.toLowerCase())
              let allegati = []
              try { allegati = typeof e.allegati === 'string' ? JSON.parse(e.allegati) : (e.allegati || []) } catch {}
              return (
                <div key={e.id} className={`p-4 rounded-lg ${isAdmin ? 'bg-blue-50/50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-medium ${isAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                      {isAdmin ? t('support') : t('you')}
                    </p>
                    <p className="text-xs font-semibold text-gray-400">
                      {new Date(e.data_ricezione).toLocaleString(getDateLocale())}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{e.corpo}</p>
                  {allegati.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200/50 space-y-1">
                      {allegati.map((a, i) => (
                        <a key={i} href={`${import.meta.env.VITE_API_BASE || '/api'}/uploads/tickets/${a.file}`} target="_blank" rel="noopener noreferrer" download={a.nome}
                          className="inline-flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 hover:bg-white border border-gray-200 mr-2 transition-colors">
                          <FileDown size={12} className="text-gray-400" />
                          <span>{a.nome}</span>
                          <span className="text-gray-400">({(a.dimensione / 1024).toFixed(0)} KB)</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="p-6 text-center text-gray-400 text-sm">{t('noMessages')}</div>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          {isReopen && isClosed && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <RotateCcw size={14} className="text-orange-500" />
              <p className="text-sm text-orange-700 font-medium">{t('writeToReopen')}</p>
            </div>
          )}
          <form onSubmit={handleReply}>
            <textarea
              ref={textareaRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={isReopen && isClosed ? t('reopenReason') : t('writeReply')}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isReopen && isClosed
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isReopen && isClosed ? <RotateCcw size={16} /> : <Send size={16} />}
                {sending ? t('sending') : isReopen && isClosed ? t('reopenTicketBtn') : t('sendReply')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500">
          {ticket.stato === 'chiuso' ? t('ticketIsClosed') : t('ticketIsResolved')} {t('ticketNoReplies')}
        </div>
      )}
    </div>
  )
}
