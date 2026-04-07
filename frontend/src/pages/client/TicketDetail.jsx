import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, AlertTriangle, Wrench, CheckCircle, Archive, FileDown, RotateCcw, XCircle, LayoutList, List, ChevronRight, ArrowUpDown, Users, Mail, Paperclip, MessageCircle, ChevronDown } from 'lucide-react'
import { clientTickets } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'
import HelpTip from '../../components/HelpTip'

const prioritaColors = {
  urgente: 'bg-red-100 text-red-800',
  alta: 'bg-orange-100 text-orange-800',
  media: 'bg-yellow-100 text-yellow-800',
  bassa: 'bg-gray-100 text-gray-600',
}
const badgeCls = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'

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
  const [emailViewMode, setEmailViewMode] = useState('esteso')
  const [expandedEmailId, setExpandedEmailId] = useState(null)
  const [emailSortAsc, setEmailSortAsc] = useState(true)
  const [onlyLast, setOnlyLast] = useState(false)
  const [showPartecipanti, setShowPartecipanti] = useState(false)
  const [allegatiCompact, setAllegatiCompact] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatFilter, setChatFilter] = useState('story')
  const textareaRef = useRef(null)

  function loadTicket() {
    return clientTickets.get(clienteId, id).then(setTicket).catch(console.error)
  }
  function loadChat() {
    clientTickets.chatList(clienteId, id).then(setChatMessages).catch(() => {})
  }

  useEffect(() => {
    if (!clienteId) return
    loadTicket().finally(() => setLoading(false))
    loadChat()
    const iv = setInterval(() => { loadTicket(); loadChat() }, 30000)
    return () => clearInterval(iv)
  }, [clienteId, id])

  async function handleChatSend(e) {
    e.preventDefault()
    if (!chatText.trim()) return
    setChatSending(true)
    try {
      await clientTickets.chatSend(clienteId, id, chatText.trim())
      setChatText('')
      loadChat()
    } catch (err) { console.error(err) }
    finally { setChatSending(false) }
  }

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
      // Notify layout to refresh alerts
      window.dispatchEvent(new CustomEvent('refresh-alerts'))
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
    <div>
      <Link
        to="/client/tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        {t('backToTickets')}
      </Link>

      <h1 className="text-2xl font-bold mb-4">{t('ticketManagement') || 'Gestione Ticket'}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{ticket.codice} — {t('openedOn')} {new Date(ticket.created_at).toLocaleDateString(getDateLocale())}</p>
            <h1 className="text-lg font-bold">{ticket.oggetto}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${badgeCls} ${config.badge}`}>
              <StatusIcon size={12} className="mr-1" />
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
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
          <div className="flex items-center gap-6">
            <span>{t('category') || 'Categoria'}: <b className="text-gray-700">{ticket.categoria}</b></span>
            <span>{t('priority') || 'Priorità'}: <span className={`${badgeCls} ${prioritaColors[ticket.priorita]}`}>{ticket.priorita}</span></span>
          </div>
          {ticket.data_evasione ? (() => {
            const ev = new Date(ticket.data_evasione + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const diffMs = ev.getTime() - today.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const color = diffDays < 0 ? 'text-red-600 font-bold' : diffDays <= 1 ? 'text-orange-500 font-semibold' : 'text-gray-600 font-medium';
            return <span className={color}>{t('resolution') || 'Evasione'}: {ev.toLocaleDateString(getDateLocale())}</span>
          })() : null}
        </div>
        {/* Partecipanti */}
        {(() => {
          const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
          const partecipanti = [...new Set((ticket.emails || []).flatMap(e => [e.mittente, ...(e.destinatario ? e.destinatario.split(',').map(d => d.trim()) : [])]).filter(addr => addr && !systemAddrs.includes(addr.toLowerCase())))]
          if (ticket.creatore_email && !partecipanti.includes(ticket.creatore_email)) partecipanti.unshift(ticket.creatore_email)
          return (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowPartecipanti(prev => !prev)}
                className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${showPartecipanti ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <ChevronRight size={14} className={`transition-transform ${showPartecipanti ? 'rotate-90' : ''}`} />
                <Users size={14} className={showPartecipanti ? 'text-teal-500' : ''} />
                <span className="font-medium">{t('participants') || 'Partecipanti'}</span>
                <span className="bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{partecipanti.length}</span>
                <span className="text-gray-400 italic ml-1">Elenco utenti che partecipano al ticket e riceveranno la risposta</span>
                <HelpTip size={12} text="I ticket aperti da un utente, se non taggati privato, sono visibili da tutti gli utenti di quella azienda. Chiunque può aggiornarlo e diventare un partecipante." />
              </button>
              {showPartecipanti && (
                <div className="mt-2 bg-teal-50 rounded-lg border border-teal-200 overflow-hidden">
                  {partecipanti.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400 italic">Nessun partecipante</p>
                  ) : (
                    <div className="divide-y divide-teal-100">
                      {partecipanti.map((addr, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                            <Mail size={12} className="text-teal-600" />
                          </div>
                          <span className="text-sm text-gray-700">{addr}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Thread */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">{t('conversation')}</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setOnlyLast(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${onlyLast ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
              Solo Ultimo
            </button>
            <button onClick={() => setEmailSortAsc(prev => !prev)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">
              <ArrowUpDown size={13} />
              <span>{emailSortAsc ? 'Vecchi → Nuovi' : 'Nuovi → Vecchi'}</span>
            </button>
          <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setEmailViewMode('esteso')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${emailViewMode === 'esteso' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <LayoutList size={13} /> {t('extended') || 'Estesa'}
            </button>
            <button onClick={() => { setEmailViewMode('compatto'); setExpandedEmailId(ticket.emails && ticket.emails.length > 0 ? ticket.emails[ticket.emails.length - 1].id : null) }} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${emailViewMode === 'compatto' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <List size={13} /> {t('compact') || 'Compatta'}
            </button>
          </div>
          </div>
        </div>
        {ticket.emails && ticket.emails.length > 0 ? (() => {
          const lastEmailId = ticket.emails[ticket.emails.length - 1]?.id
          const allSorted = [...ticket.emails].sort((a, b) => {
            const da = new Date(a.data_ricezione), db2 = new Date(b.data_ricezione)
            return emailSortAsc ? da - db2 : db2 - da
          })
          const sortedEmails = onlyLast ? allSorted.filter(e => e.id === lastEmailId) : allSorted
          return emailViewMode === 'esteso' ? (
            <div className="space-y-3 p-3">
              {sortedEmails.map((e) => {
                const isLast = e.id === lastEmailId
                const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
                const isAdmin = systemAddrs.includes(e.mittente.toLowerCase())
                let allegati = []
                try { allegati = typeof e.allegati === 'string' ? JSON.parse(e.allegati) : (e.allegati || []) } catch {}
                return (
                  <div key={e.id} className={`p-4 rounded-lg ${isAdmin ? 'bg-blue-50/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-sm font-medium ${isAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                        {isAdmin ? t('support') : (<>{e.mittente} <span className="text-xs text-gray-400">({e.mittente === ticket.creatore_email ? 'Owner' : 'Partecipante'})</span> <span className="text-xs italic text-gray-400">{!e.message_id || (e.message_id && e.message_id.startsWith('<simulated')) ? 'msg da Portale' : 'msg da Reply email'}</span></>)}
                        {isLast && <span className="ml-2 bg-red-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5 uppercase">Last msg</span>}
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
              })}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedEmails.map((e) => {
                const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
                const isAdmin = systemAddrs.includes(e.mittente.toLowerCase())
                const isExpanded = expandedEmailId === e.id
                const isLast = e.id === lastEmailId
                let allegati = []
                try { allegati = typeof e.allegati === 'string' ? JSON.parse(e.allegati) : (e.allegati || []) } catch {}
                return (
                  <div key={e.id}>
                    <button
                      onClick={() => setExpandedEmailId(isExpanded ? null : e.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-left"
                    >
                      <ChevronRight size={14} className={`text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isAdmin ? 'bg-blue-500' : 'bg-amber-500'}`} />
                      <span className={`text-sm font-medium truncate ${isAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                        {isAdmin ? t('support') : (<>{e.mittente} <span className="text-xs text-gray-400 font-normal">({e.mittente === ticket.creatore_email ? 'Owner' : 'Partecipante'})</span> <span className="text-xs italic text-gray-400 font-normal">{!e.message_id || (e.message_id && e.message_id.startsWith('<simulated')) ? 'msg da Portale' : 'msg da Reply email'}</span></>)}
                        {isLast && <span className="ml-2 bg-red-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5 uppercase">Last msg</span>}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto shrink-0">{new Date(e.data_ricezione).toLocaleString(getDateLocale())}</span>
                    </button>
                    {isExpanded && (
                      <div className={`px-10 pb-3 ${isAdmin ? 'bg-blue-50/50' : 'bg-amber-50/50'}`}>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.corpo}</p>
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
                    )}
                  </div>
                )
              })}
            </div>
          )
        })() : (
          <div className="p-6 text-center text-gray-400 text-sm">{t('noMessages')}</div>
        )}
      </div>

      {/* Reply Form */}
      {ticket.stato === 'risolto' && !isReopen ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Send size={18} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-400">Rispondi alla Assistenza</h2>
          </div>
          <div className="p-8 bg-gray-50 rounded-b-xl text-center text-sm text-gray-400">
            Ticket risolto — non è possibile scrivere messaggi
          </div>
        </div>
      ) : showReplyForm ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Send size={18} className="text-green-500" />
            <h2 className="text-lg font-semibold">Rispondi alla Assistenza</h2>
          </div>
          <div className="p-4">
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
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500">
          {ticket.stato === 'chiuso' ? t('ticketIsClosed') : t('ticketIsResolved')} {t('ticketNoReplies')}
        </div>
      )}

      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Raccolta Allegati */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip size={18} className="text-blue-500" />
              <h2 className="text-lg font-semibold">Raccolta Allegati</h2>
            </div>
            <button onClick={() => setAllegatiCompact(prev => !prev)}
              className={`text-xs cursor-pointer transition-colors ${allegatiCompact ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {allegatiCompact ? 'Espandi' : 'Compatta'}
            </button>
          </div>
          {!allegatiCompact && (() => {
            const allAllegati = (ticket.emails || []).flatMap(e => {
              let att = []
              try { att = typeof e.allegati === 'string' ? JSON.parse(e.allegati) : (e.allegati || []) } catch {}
              return att.map(a => ({ ...a, mittente: e.mittente, data: e.data_ricezione }))
            })
            return allAllegati.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {allAllegati.map((a, i) => (
                  <a key={i} href={`${import.meta.env.VITE_API_BASE || '/api'}/uploads/tickets/${a.file}`} target="_blank" rel="noopener noreferrer" download={a.nome}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <FileDown size={16} className="text-gray-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate">{a.nome}</p>
                      <p className="text-xs text-gray-400">{(a.dimensione / 1024).toFixed(0)} KB — {new Date(a.data).toLocaleDateString(getDateLocale())}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-400">Nessun allegato</div>
            )
          })()}
        </div>

        {/* Chat Interna */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-green-500" />
              <h2 className="text-lg font-semibold">Chat Interna</h2>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{[...new Set(chatMessages.map(m => m.utente_email))].length}</span>
              <HelpTip size={12} text="Chat riservata tra i colleghi della tua azienda. I messaggi qui non sono visibili all'assistenza tecnica STM. Ogni partecipante riceve una notifica email quando qualcuno scrive. Per rispondere usa il portale, non la email." />
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setChatFilter('lastmsg')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${chatFilter === 'lastmsg' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                LastMSG
              </button>
              <button onClick={() => setChatFilter('story')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium cursor-pointer transition-colors ${chatFilter === 'story' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                Story
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {(() => {
              const msgs = chatFilter === 'lastmsg' && chatMessages.length > 0 ? [chatMessages[chatMessages.length - 1]] : chatMessages
              return msgs.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {msgs.map(m => (
                    <div key={m.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-green-700">{m.utente_nome || m.utente_email}</span>
                        <span className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleString(getDateLocale())}</span>
                      </div>
                      <p className="text-sm text-gray-700">{m.messaggio}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">Nessun messaggio</div>
              )
            })()}
          </div>
          <form onSubmit={handleChatSend} className="p-3 border-t border-gray-100 flex gap-2">
            <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Scrivi ai colleghi..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
            <button type="submit" disabled={chatSending || !chatText.trim()}
              className="bg-green-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer">
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  )
}
