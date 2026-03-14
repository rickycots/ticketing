import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Mail, StickyNote, Send, Building2, Phone, User, BookOpen, ChevronDown, ChevronRight, Bot, Sparkles, Loader2, Paperclip, X, FileDown } from 'lucide-react'
import { tickets, emails, users, schede as schedeApi, ai } from '../../api/client'

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

  useEffect(() => {
    tickets.get(id).then(t => {
      setTicket(t)
      if (t.cliente_id) {
        schedeApi.list(t.cliente_id).then(setSchedeList).catch(() => {})
      }
      // Refresh sidebar badge (ticket marked as read by backend)
      if (loadSidebarCounts) loadSidebarCounts()
    }).catch(console.error).finally(() => setLoading(false))
    if (isAdmin) users.list().then(setUserList).catch(() => {})
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
    } catch (err) { console.error(err) }
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

      {/* Client banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
          <Building2 size={16} className="text-teal-600" />
        </div>
        <span className="text-sm font-bold text-teal-900">{ticket.cliente_nome}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{ticket.codice} — {new Date(ticket.created_at).toLocaleDateString('it-IT')}</p>
                <h2 className="text-lg font-bold">{ticket.oggetto}</h2>
              </div>
              <div className="flex gap-2">
                <span className={`${badgeCls} ${prioritaColors[ticket.priorita]}`}>{ticket.priorita}</span>
                <span className={`${badgeCls} ${statoColors[ticket.stato]}`}>{statoLabels[ticket.stato]}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
              <span>Categoria: <b className="text-gray-700">{ticket.categoria}</b></span>
              {ticket.data_evasione ? (() => {
                const ev = new Date(ticket.data_evasione + 'T00:00:00');
                const today = new Date(); today.setHours(0,0,0,0);
                const diffMs = ev.getTime() - today.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                const color = diffDays < 0 ? 'text-red-600 font-bold' : diffDays <= 1 ? 'text-orange-500 font-semibold' : 'text-gray-600 font-medium';
                return <span className={color}>Evasione: {ev.toLocaleDateString('it-IT')}</span>
              })() : null}
            </div>
          </div>

          {/* Email Thread */}
          {ticket.emails?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Mail size={18} className="text-blue-500" />
                <h2 className="text-lg font-semibold">Thread Email</h2>
              </div>
              <div className="space-y-3 p-3">
                {ticket.emails.map(e => {
                  const systemAddrs = ['ticketing@stmdomotica.it', 'assistenzatecnica@stmdomotica.it', 'noreply@stmdomotica.it', 'admin@ticketing.local']
                  const isOurs = systemAddrs.includes(e.mittente.toLowerCase())
                  let allegati = []
                  try { allegati = typeof e.allegati === 'string' ? JSON.parse(e.allegati) : (e.allegati || []) } catch {}
                  return (
                    <div key={e.id} className={`p-4 rounded-lg ${isOurs ? 'bg-blue-50' : 'bg-amber-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-medium ${isOurs ? 'text-blue-700' : 'text-amber-700'}`}>
                          {isOurs ? 'Noi (Assistenza)' : e.mittente}
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
            </div>
          )}

          {/* Reply Form */}
          {ticket.stato !== 'chiuso' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Send size={18} className="text-green-500" />
                <h2 className="text-lg font-semibold">Rispondi al Cliente</h2>
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
                    Imposta stato "In attesa" del cliente
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
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={noteToKB} onChange={(e) => setNoteToKB(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Salva in Knowledge Base (disponibile per AI cliente)
                </label>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Stato</label>
                <select value={ticket.stato} onChange={(e) => handleFieldChange('stato', e.target.value)} className={selectCls}>
                  {Object.entries(statoLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Assegna a</label>
                <select value={ticket.assegnato_a || ''} onChange={(e) => handleFieldChange('assegnato_a', e.target.value ? Number(e.target.value) : null)} className={selectCls}>
                  <option value="">Non assegnato</option>
                  {userList.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.ruolo})</option>)}
                </select>
              </div>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setAiOpen(!aiOpen)}
              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-purple-500" />
                <h3 className="text-sm font-semibold">Assistente AI</h3>
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
                        <span className="whitespace-pre-wrap">{msg.testo}</span>
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
        </div>
      </div>
    </div>
  )
}
