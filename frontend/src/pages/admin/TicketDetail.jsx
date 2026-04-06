import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Mail, StickyNote, Send, Building2, Phone, User, BookOpen, ChevronDown, ChevronRight, Bot, Sparkles, Loader2, Paperclip, X, FileDown, Users, LayoutList, List, ArrowUpDown } from 'lucide-react'
import { tickets, emails, users, schede as schedeApi, ai } from '../../api/client'
import HelpTip from '../../components/HelpTip'

const prioritaColors = {
  urgente: 'bg-red-100 text-red-800', alta: 'bg-orange-100 text-orange-800',
  media: 'bg-yellow-100 text-yellow-800', bassa: 'bg-gray-100 text-gray-600',
}
const statoColors = {
  aperto: 'bg-blue-100 text-blue-800', in_lavorazione: 'bg-yellow-100 text-yellow-800',
  in_attesa: 'bg-orange-100 text-orange-800', risolto: 'bg-green-100 text-green-800', chiuso: 'bg-gray-100 text-gray-600',
}
const statoLabels = { aperto: 'Aperto', in_lavorazione: 'In lavorazione', in_attesa: 'In attesa', risolto: 'Risolto', chiuso: 'Chiuso' }

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
const badgeCls = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"

export default function TicketDetail() {
  const { id } = useParams()
  const { loadSidebarCounts } = useOutletContext() || {}
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [setInAttesa, setSetInAttesa] = useState(true)
  const [replyFiles, setReplyFiles] = useState([])
  const replyFileRef = useRef(null)
  const [sending, setSending] = useState(false)
  const [userList, setUserList] = useState([])
  const [noteText, setNoteText] = useState('')
  const [sendingNote, setSendingNote] = useState(false)
  const [noteToKB, setNoteToKB] = useState(false)
  const [showPartecipanti, setShowPartecipanti] = useState(false)
  const [emailViewMode, setEmailViewMode] = useState('esteso')
  const [emailSortAsc, setEmailSortAsc] = useState(true)
  const [expandedEmailId, setExpandedEmailId] = useState(null)
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  // KB state
  const [schedeList, setSchedeList] = useState([])
  const [schedeOpen, setSchedeOpen] = useState(true)
  const [expandedScheda, setExpandedScheda] = useState(null)
  const [newSchedaForm, setNewSchedaForm] = useState(false)
  const [schedaForm, setSchedaForm] = useState({ titolo: '', contenuto: '' })
  const [savingScheda, setSavingScheda] = useState(false)

  // AI state
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOpen, setAiOpen] = useState(true)

  function loadTicket() {
    return tickets.get(id).then(t => {
      setTicket(t)
      if (t.cliente_id) {
        schedeApi.list(t.cliente_id).then(setSchedeList).catch(() => {})
      }
    }).catch(console.error)
  }

  useEffect(() => {
    loadTicket().then(() => {
      if (loadSidebarCounts) loadSidebarCounts()
    }).finally(() => setLoading(false))
    if (isAdmin) users.list().then(setUserList).catch(() => {})
    // Auto-refresh every 30s
    const iv = setInterval(loadTicket, 30000)
    return () => clearInterval(iv)
  }, [id])

  async function handleFieldChange(field, value) {
    const updated = await tickets.update(id, { [field]: value })
    setTicket(prev => ({ ...prev, ...updated }))
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim() || !ticket) return
    setSending(true)
    try {
      await emails.create({
        tipo: 'ticket', destinatario: ticket.creatore_email || ticket.cliente_email,
        oggetto: `Re: [TICKET #${ticket.codice}] ${ticket.oggetto}`,
        corpo: replyText.trim(), cliente_id: ticket.cliente_id, ticket_id: ticket.id,
        thread_id: `thread-${ticket.codice}`,
      }, replyFiles.length > 0 ? replyFiles : null)
      if (setInAttesa && ticket.stato !== 'chiuso' && ticket.stato !== 'risolto') {
        await tickets.update(id, { stato: 'in_attesa' })
      }
      setTicket(await tickets.get(id))
      setReplyText('')
      setReplyFiles([])
    } catch (err) { console.error(err); alert(err.message || 'Errore invio email') }
    finally { setSending(false) }
  }

  async function handleCreateScheda(e) {
    e.preventDefault()
    if (!schedaForm.titolo.trim() || !schedaForm.contenuto.trim()) return
    setSavingScheda(true)
    try {
      await schedeApi.create(ticket.cliente_id, schedaForm)
      setSchedeList(await schedeApi.list(ticket.cliente_id))
      setSchedaForm({ titolo: '', contenuto: '' })
      setNewSchedaForm(false)
    } catch (err) { console.error(err) }
    finally { setSavingScheda(false) }
  }

  async function handleAiAsk(domanda) {
    if (!domanda.trim()) return
    const question = domanda.trim()
    setAiInput('')
    setAiMessages(prev => [...prev, { tipo: 'domanda', testo: question }])
    setAiLoading(true)
    try {
      const result = await ai.ticketAssist(parseInt(id), question)
      setAiMessages(prev => [...prev, { tipo: 'risposta', testo: result.risposta }])
    } catch (err) {
      setAiMessages(prev => [...prev, { tipo: 'errore', testo: err.message }])
    }
    finally { setAiLoading(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (!ticket) return <div className="text-center text-gray-400 py-12">Ticket non trovato</div>

  return (
    <div>
      <Link to="/admin/tickets" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
        <ArrowLeft size={16} /> Torna alla lista
      </Link>

      <h1 className="text-2xl font-bold mb-4">Gestione Ticket</h1>

      {/* Client banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
          <Building2 size={16} className="text-teal-600" />
        </div>
        <span className="text-sm font-bold text-teal-900">Cliente: {ticket.cliente_nome}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{ticket.codice} — aperto il giorno {new Date(ticket.created_at).toLocaleDateString('it-IT')}</p>
                <h2 className="text-lg font-bold">{ticket.oggetto}</h2>
              </div>
              <div className="flex gap-2">
                <span className={`${badgeCls} ${statoColors[ticket.stato]}`}>{statoLabels[ticket.stato]}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
              <div className="flex items-center gap-6">
                <span>Categoria: <b className="text-gray-700">{ticket.categoria}</b></span>
                <span>Priorità: <span className={`${badgeCls} ${prioritaColors[ticket.priorita]}`}>{ticket.priorita}</span></span>
              </div>
              {ticket.data_evasione ? (() => {
                const ev = new Date(ticket.data_evasione + 'T00:00:00');
                const today = new Date(); today.setHours(0,0,0,0);
                const diffMs = ev.getTime() - today.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                const color = diffDays < 0 ? 'text-red-600 font-bold' : diffDays <= 1 ? 'text-orange-500 font-semibold' : 'text-gray-600 font-medium';
                return <span className={color}>Evasione: {ev.toLocaleDateString('it-IT')}</span>
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
                    <span className="font-medium">Partecipanti</span>
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

          {/* Email Thread */}
          {ticket.emails?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={18} className="text-blue-500" />
                  <h2 className="text-lg font-semibold">Thread Messaggi</h2>
                  <HelpTip text="Storico completo delle comunicazioni sul ticket. Include messaggi dal portale e risposte via email. I messaggi in azzurro sono le risposte inviate dal nostro team." />
                  <span className="text-xs text-gray-400 italic">Ciclo messaggi ticket dal portale o mail</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setEmailSortAsc(prev => !prev)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">
                    <ArrowUpDown size={13} />
                    <span>{emailSortAsc ? 'Vecchi → Nuovi' : 'Nuovi → Vecchi'}</span>
                  </button>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setEmailViewMode('esteso')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${emailViewMode === 'esteso' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <LayoutList size={13} /> Estesa
                  </button>
                  <button onClick={() => { setEmailViewMode('compatto'); setExpandedEmailId(ticket.emails.length > 0 ? ticket.emails[ticket.emails.length - 1].id : null) }} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${emailViewMode === 'compatto' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <List size={13} /> Compatta
                  </button>
                </div>
                </div>
              </div>
              {(() => {
                const sortedEmails = [...ticket.emails].sort((a, b) => {
                  const da = new Date(a.data_ricezione), db2 = new Date(b.data_ricezione)
                  return emailSortAsc ? da - db2 : db2 - da
                })
                const lastEmailId = ticket.emails[ticket.emails.length - 1]?.id
                return emailViewMode === 'esteso' ? (
                <div className="space-y-3 p-3">
                  {sortedEmails.map((e) => {
                    const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
                    const isOurs = systemAddrs.includes(e.mittente.toLowerCase())
                    const isLast = e.id === lastEmailId
                    let allegati = []
                    try { allegati = typeof e.allegati === 'string' ? JSON.parse(e.allegati) : (e.allegati || []) } catch {}
                    return (
                      <div key={e.id} className={`p-4 rounded-lg ${isOurs ? 'bg-blue-50' : 'bg-amber-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className={`text-sm font-medium ${isOurs ? 'text-blue-700' : 'text-amber-700'}`}>
                            {isOurs ? 'Noi (Assistenza)' : (<>{e.mittente} <span className="text-xs text-gray-400">({e.mittente === ticket.creatore_email ? 'Owner' : 'Partecipante'})</span> <span className="text-xs italic text-gray-400">{!e.message_id || (e.message_id && e.message_id.startsWith('<simulated')) ? 'msg da Portale' : 'msg da Reply email'}</span></>)}
                            {isLast && <span className="ml-2 bg-red-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5 uppercase">Last msg</span>}
                          </p>
                          <p className="text-xs font-semibold text-gray-400">{new Date(e.data_ricezione).toLocaleString('it-IT')}</p>
                        </div>
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
                    )
                  })}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {sortedEmails.map((e) => {
                    const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
                    const isOurs = systemAddrs.includes(e.mittente.toLowerCase())
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
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isOurs ? 'bg-blue-500' : 'bg-amber-500'}`} />
                          <span className={`text-sm font-medium truncate ${isOurs ? 'text-blue-700' : 'text-gray-700'}`}>
                            {isOurs ? 'Noi (Assistenza)' : (<>{e.mittente} <span className="text-xs text-gray-400 font-normal">({e.mittente === ticket.creatore_email ? 'Owner' : 'Partecipante'})</span> <span className="text-xs italic text-gray-400 font-normal">{!e.message_id || (e.message_id && e.message_id.startsWith('<simulated')) ? 'msg da Portale' : 'msg da Reply email'}</span></>)}
                            {isLast && <span className="ml-2 bg-red-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5 uppercase">Last msg</span>}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto shrink-0">{new Date(e.data_ricezione).toLocaleString('it-IT')}</span>
                        </button>
                        {isExpanded && (
                          <div className={`px-10 pb-3 ${isOurs ? 'bg-blue-50/50' : 'bg-amber-50/50'}`}>
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
              })()}
            </div>
          )}

          {/* Reply Form */}
          {ticket.stato === 'risolto' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Send size={18} className="text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-400">Rispondi al Cliente</h2>
              </div>
              <div className="p-8 bg-gray-50 rounded-b-xl text-center text-sm text-gray-400">
                Ticket risolto — non è possibile scrivere messaggi
              </div>
            </div>
          )}

          {ticket.stato !== 'chiuso' && ticket.stato !== 'risolto' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Send size={18} className="text-green-500" />
                <h2 className="text-lg font-semibold flex items-center gap-2">Rispondi al Cliente <HelpTip text="Scrivi qui la risposta al cliente. Verrà salvata nel thread e inviata via email a tutti i partecipanti del ticket (creatore + chi ha risposto via mail)." /></h2>
                <p className="text-xs text-gray-400 italic">La risposta inoltrerà anche una mail a tutti i partecipanti</p>
              </div>
              <form onSubmit={handleReply} className="p-4 space-y-3">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Scrivi la risposta al cliente..." rows={4}
                  className={`${selectCls} resize-none`} />
                {/* Allegati */}
                <div>
                  <input ref={replyFileRef} type="file" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.xlsx,.zip"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || [])
                      if (selected.length > 0) {
                        setReplyFiles(prev => [...prev, ...selected].slice(0, 5))
                      }
                      // reset per permettere ri-selezione stesso file
                      setTimeout(() => { if (replyFileRef.current) replyFileRef.current.value = '' }, 100)
                    }}
                    className="hidden" />
                  <button type="button" onClick={() => replyFileRef.current?.click()} disabled={replyFiles.length >= 5}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 cursor-pointer transition-colors">
                    <Paperclip size={14} /> Allega file {replyFiles.length > 0 && `(${replyFiles.length}/5)`}
                  </button>
                  {replyFiles.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {replyFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                          <Paperclip size={12} className="text-gray-400" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                          <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 cursor-pointer">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={setInAttesa} onChange={(e) => setSetInAttesa(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Imposta stato "In attesa" del cliente <HelpTip size={12} text="Attivando questa opzione, dopo l'invio della risposta il ticket passerà automaticamente allo stato 'In attesa'. Indica che il team ha risposto e si attende un riscontro dal cliente prima di procedere." />
                  </label>
                  <button type="submit" disabled={sending || !replyText.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <Send size={16} /> {sending ? 'Invio...' : 'Invia Risposta'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Internal Notes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <StickyNote size={18} className="text-yellow-500" />
              <h2 className="text-lg font-semibold">Note Interne</h2>
              <HelpTip text="Note visibili solo al team interno (admin e tecnici). Il cliente non vede queste note. Utili per appunti, promemoria e comunicazioni interne sul ticket." />
            </div>
            {ticket.note?.length > 0 && (
              <div className="divide-y divide-gray-100">
                {ticket.note.map(n => (
                  <div key={n.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700">{n.utente_nome}</p>
                      <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('it-IT')}</p>
                    </div>
                    <p className="text-sm text-gray-600">{n.testo}</p>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!noteText.trim()) return
              setSendingNote(true)
              try {
                await tickets.addNote(id, noteText.trim(), noteToKB)
                setTicket(await tickets.get(id))
                setNoteText('')
                setNoteToKB(false)
              } catch (err) { console.error(err) }
              finally { setSendingNote(false) }
            }} className="p-4 border-t border-gray-100 space-y-2">
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Aggiungi una nota interna..." rows={2}
                className={`${selectCls} resize-none`} />
              <div className="flex items-center justify-between">
                {(isAdmin || currentUser.abilitato_ai) ? (
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                    <input type="checkbox" checked={noteToKB} onChange={(e) => setNoteToKB(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Salva in Knowledge Base (disponibile per AI cliente) <HelpTip size={12} text="La nota verrà salvata anche nella Knowledge Base del cliente. L'AI del portale cliente potrà utilizzarla per rispondere alle domande degli utenti di questa azienda." />
                  </label>
                ) : <span />}
                <button type="submit" disabled={sendingNote || !noteText.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <StickyNote size={14} /> {sendingNote ? 'Salvataggio...' : 'Aggiungi Nota'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold mb-3">Azioni</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">Stato <HelpTip size={12} text="Lo stato si aggiorna automaticamente: 'Aperto' alla creazione, 'In lavorazione' quando si assegna un tecnico, si scrive una nota o si risponde, 'In attesa' con la checkbox dopo una risposta. Solo 'Risolto' è selezionabile manualmente." /></label>
                <select value={ticket.stato} onChange={(e) => handleFieldChange('stato', e.target.value)} className={selectCls}>
                  {Object.entries(statoLabels).filter(([v]) => v !== 'chiuso').map(([v, l]) => <option key={v} value={v} disabled={v !== 'risolto' && v !== ticket.stato}>{l}</option>)}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assegna a</label>
                  <select value={ticket.assegnato_a || ''} onChange={(e) => handleFieldChange('assegnato_a', e.target.value ? Number(e.target.value) : null)} className={selectCls}>
                    <option value="">Non assegnato</option>
                    {userList.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.ruolo})</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Knowledge Base Cards */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setSchedeOpen(!schedeOpen)}
              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-teal-500" />
                <h3 className="text-sm font-semibold">Schede Cliente</h3>
                <span className="text-xs text-gray-400">({schedeList.length})</span>
              </div>
              {schedeOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            {schedeOpen && (
              <div className="border-t border-gray-100">
                {schedeList.length === 0 && !newSchedaForm ? (
                  <div className="p-4 text-sm text-gray-400 text-center">Nessuna scheda per questo cliente</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {schedeList.map(s => (
                      <div key={s.id}>
                        <button onClick={() => setExpandedScheda(expandedScheda === s.id ? null : s.id)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50">
                          <span className="text-sm font-medium text-gray-700">{s.titolo}</span>
                          {expandedScheda === s.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        </button>
                        {expandedScheda === s.id && (
                          <div className="px-4 pb-3">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">{s.contenuto}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Add new KB card (admin only) */}
                {isAdmin && (
                  <div className="p-3 border-t border-gray-100">
                    {newSchedaForm ? (
                      <form onSubmit={handleCreateScheda} className="space-y-2">
                        <input type="text" value={schedaForm.titolo} onChange={e => setSchedaForm(f => ({ ...f, titolo: e.target.value }))}
                          placeholder="Titolo scheda..." className={`${selectCls} text-xs`} />
                        <textarea value={schedaForm.contenuto} onChange={e => setSchedaForm(f => ({ ...f, contenuto: e.target.value }))}
                          placeholder="Contenuto..." rows={3} className={`${selectCls} text-xs resize-none`} />
                        <div className="flex gap-2">
                          <button type="submit" disabled={savingScheda}
                            className="bg-teal-600 text-white rounded-lg px-3 py-1 text-xs font-medium hover:bg-teal-700 disabled:opacity-50 cursor-pointer">
                            {savingScheda ? 'Salvataggio...' : 'Salva'}
                          </button>
                          <button type="button" onClick={() => { setNewSchedaForm(false); setSchedaForm({ titolo: '', contenuto: '' }) }}
                            className="bg-gray-100 text-gray-600 rounded-lg px-3 py-1 text-xs hover:bg-gray-200 cursor-pointer">
                            Annulla
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setNewSchedaForm(true)}
                        className="w-full text-center text-xs text-teal-600 hover:text-teal-800 font-medium py-1 cursor-pointer">
                        + Aggiungi scheda
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Assistant */}
          {(isAdmin || !!currentUser.abilitato_ai) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setAiOpen(!aiOpen)}
              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-purple-500" />
                <h3 className="text-sm font-semibold flex items-center gap-1">Assistente AI <HelpTip size={12} text="L'AI analizza il repository documenti, le FAQ dei fornitori, la Knowledge Base del cliente e lo storico ticket per suggerirti risposte. Attiva 'Usa KB' per includere la Knowledge Base specifica del cliente." /></h3>
              </div>
              {aiOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            {aiOpen && (
              <div className="border-t border-gray-100">
                {/* Quick suggestions */}
                <div className="px-4 pt-3 flex flex-wrap gap-1.5">
                  {['Analizza il problema', 'Suggerisci soluzione', 'Prepara risposta'].map(s => (
                    <button key={s} onClick={() => handleAiAsk(s)} disabled={aiLoading}
                      className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2.5 py-1 text-xs font-medium hover:bg-purple-100 disabled:opacity-50 cursor-pointer transition-colors">
                      <Sparkles size={10} /> {s}
                    </button>
                  ))}
                </div>

                {/* Chat messages */}
                {aiMessages.length > 0 && (
                  <div className="px-4 pt-3 space-y-2 max-h-80 overflow-y-auto">
                    {aiMessages.map((msg, i) => (
                      <div key={i} className={`text-xs rounded-lg p-2.5 ${
                        msg.tipo === 'domanda' ? 'bg-purple-50 text-purple-800 ml-4' :
                        msg.tipo === 'errore' ? 'bg-red-50 text-red-700' :
                        'bg-gray-50 text-gray-700 mr-2'
                      }`}>
                        {msg.tipo === 'domanda' && <span className="font-semibold block mb-0.5">Tu:</span>}
                        {msg.tipo === 'risposta' && <span className="font-semibold block mb-0.5 text-purple-600">AI:</span>}
                        <span className="whitespace-pre-wrap break-words">{msg.testo}</span>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex items-center gap-2 text-xs text-purple-500 p-2">
                        <Loader2 size={14} className="animate-spin" /> Elaborazione...
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="p-3">
                  <div className="flex gap-2">
                    <input type="text" value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiAsk(aiInput) } }}
                      placeholder="Chiedi all'assistente..."
                      disabled={aiLoading}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50" />
                    <button onClick={() => handleAiAsk(aiInput)} disabled={aiLoading || !aiInput.trim()}
                      className="bg-purple-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-purple-700 disabled:opacity-50 cursor-pointer transition-colors">
                      Chiedi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
