import { useState, useEffect } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { Mail, MailOpen, AlertTriangle, FolderKanban, Plus, Send, Reply, X, Star, Info, Building2 } from 'lucide-react'
import { emails, projects, activities, clients as clientsApi } from '../../api/client'
import Pagination from '../../components/Pagination'

const tipoLabels = {
  email_cliente: 'Email Cliente',
  altro: 'Altro',
}

const tipoColors = {
  email_cliente: 'bg-purple-100 text-purple-800',
  altro: 'bg-gray-100 text-gray-600',
}

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
const filterSelectCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

export default function EmailInbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { loadSidebarCounts } = useOutletContext() || {}

  const [emailList, setEmailList] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quickFilter, setQuickFilter] = useState('tutte')
  const [filterCounts, setFilterCounts] = useState({ tutte: 0, da_leggere: 0, non_assegnate: 0, bloccanti: 0, rilevanti: 0 })
  const [filterTipo, setFilterTipo] = useState('')
  const [filterCliente, setFilterCliente] = useState(searchParams.get('cliente_id') || '')
  const [filterProgetto, setFilterProgetto] = useState(searchParams.get('progetto_id') || '')
  const [filterAttivita, setFilterAttivita] = useState(searchParams.get('attivita_id') || '')
  const [projectList, setProjectList] = useState([])
  const [clientList, setClientList] = useState([])

  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 })

  // Activities for assignment dropdown (detail panel)
  const [activityList, setActivityList] = useState([])

  // Activities for filter dropdown
  const [filterActivityList, setFilterActivityList] = useState([])

  // Compose state
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ cliente_id: '', oggetto: '', corpo: '' })
  const [sending, setSending] = useState(false)

  // Reply state
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    projects.list({ limit: 1000 }).then(res => setProjectList(res.data || [])).catch(console.error)
    clientsApi.list({ limit: 1000 }).then(res => setClientList(res.data || [])).catch(console.error)
  }, [])

  // Load filter activities when filterProgetto changes
  useEffect(() => {
    if (filterProgetto) {
      activities.list(filterProgetto).then(setFilterActivityList).catch(() => setFilterActivityList([]))
    } else {
      setFilterActivityList([])
    }
  }, [filterProgetto])

  function loadEmails() {
    const params = { page }
    if (filterTipo) params.tipo = filterTipo
    if (filterCliente) params.cliente_id = filterCliente
    if (filterProgetto) params.progetto_id = filterProgetto
    if (filterAttivita) params.attivita_id = filterAttivita
    if (quickFilter !== 'tutte') params.quick_filter = quickFilter
    emails.list(params).then(res => {
      setEmailList(res.data)
      setPagination({ total: res.total, totalPages: res.totalPages, limit: res.limit })
      if (res.counts) setFilterCounts(res.counts)
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadEmails() }, [filterTipo, filterCliente, filterProgetto, filterAttivita, quickFilter, page])

  // Filtered project list based on selected client
  const filteredProjects = filterCliente
    ? projectList.filter(p => p.cliente_id === Number(filterCliente))
    : projectList

  function handleFilterCliente(value) {
    setFilterCliente(value)
    setFilterProgetto('')
    setFilterAttivita('')
    setPage(1)
    updateUrlParams({ cliente_id: value, progetto_id: '', attivita_id: '' })
  }

  function handleFilterProgetto(value) {
    setFilterProgetto(value)
    setFilterAttivita('')
    setPage(1)
    updateUrlParams({ progetto_id: value, attivita_id: '' })
  }

  function handleFilterAttivita(value) {
    setFilterAttivita(value)
    setPage(1)
    updateUrlParams({ attivita_id: value })
  }

  function updateUrlParams(updates) {
    const newParams = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(updates)) {
      if (v) newParams.set(k, v)
      else newParams.delete(k)
    }
    setSearchParams(newParams, { replace: true })
  }

  function clearFilters() {
    setFilterCliente('')
    setFilterProgetto('')
    setFilterAttivita('')
    setFilterTipo('')
    setQuickFilter('tutte')
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  const hasFilters = filterCliente || filterProgetto || filterAttivita || filterTipo

  async function handleSelect(email) {
    const wasUnread = !email.letta
    const detail = await emails.get(email.id)
    setSelected(detail)
    setShowReply(false)
    setReplyText('')
    loadActivities(detail.progetto_id)
    loadEmails()
    if (wasUnread && loadSidebarCounts) loadSidebarCounts()
  }

  async function handleToggleBloccante(emailId, current) {
    await emails.update(emailId, { is_bloccante: !current })
    const detail = await emails.get(emailId)
    setSelected(detail)
    loadEmails()
  }

  async function handleSetRilevanza(emailId, value) {
    const newVal = selected.rilevanza === value ? null : value
    await emails.update(emailId, { rilevanza: newVal })
    const detail = await emails.get(emailId)
    setSelected(detail)
    loadEmails()
  }

  async function loadActivities(progettoId) {
    if (!progettoId) {
      setActivityList([])
      return
    }
    try {
      const data = await activities.list(progettoId)
      setActivityList(data)
    } catch (err) {
      setActivityList([])
    }
  }

  async function handleAssignProject(emailId, progettoId) {
    await emails.update(emailId, { progetto_id: progettoId || null })
    const detail = await emails.get(emailId)
    setSelected(detail)
    loadActivities(progettoId)
    loadEmails()
  }

  async function handleAssignActivity(emailId, attivitaId) {
    await emails.update(emailId, { attivita_id: attivitaId || null })
    const detail = await emails.get(emailId)
    setSelected(detail)
    loadEmails()
  }

  async function handleCompose(e) {
    e.preventDefault()
    setSending(true)
    try {
      const cliente = clientList.find(c => c.id === Number(composeForm.cliente_id))
      await emails.create({
        tipo: 'email_cliente',
        destinatario: cliente?.email || composeForm.cliente_id,
        oggetto: composeForm.oggetto,
        corpo: composeForm.corpo,
        cliente_id: cliente?.id || null,
      })
      setComposeForm({ cliente_id: '', oggetto: '', corpo: '' })
      setShowCompose(false)
      loadEmails()
    } catch (err) { console.error(err) }
    finally { setSending(false) }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim() || !selected) return
    setSendingReply(true)
    try {
      const threadId = selected.thread_id || `thread-email-${selected.id}`
      await emails.create({
        tipo: selected.tipo,
        destinatario: selected.mittente,
        oggetto: selected.oggetto.startsWith('Re:') ? selected.oggetto : `Re: ${selected.oggetto}`,
        corpo: replyText.trim(),
        cliente_id: selected.cliente_id || null,
        progetto_id: selected.progetto_id || null,
        thread_id: threadId,
      })
      // If original didn't have a thread_id, assign one now
      if (!selected.thread_id) {
        await emails.update(selected.id, {})
      }
      const detail = await emails.get(selected.id)
      setSelected(detail)
      setReplyText('')
      setShowReply(false)
      loadEmails()
    } catch (err) { console.error(err) }
    finally { setSendingReply(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Email</h1>
        <button
          onClick={() => { setShowCompose(!showCompose); setSelected(null) }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Nuova Email
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filterTipo}
          onChange={(e) => { setFilterTipo(e.target.value); setPage(1) }}
          className={filterSelectCls}
        >
          <option value="">Tipo: Tutte</option>
          <option value="email_cliente">Email Cliente</option>
          <option value="altro">Altro</option>
        </select>

        <select
          value={filterCliente}
          onChange={(e) => handleFilterCliente(e.target.value)}
          className={filterSelectCls}
        >
          <option value="">Cliente: Tutti</option>
          {clientList.map(c => (
            <option key={c.id} value={c.id}>{c.nome_azienda}</option>
          ))}
        </select>

        <select
          value={filterProgetto}
          onChange={(e) => handleFilterProgetto(e.target.value)}
          className={filterSelectCls}
          disabled={filteredProjects.length === 0 && !filterProgetto}
        >
          <option value="">Progetto: Tutti</option>
          {filteredProjects.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>

        {filterProgetto && (
          <select
            value={filterAttivita}
            onChange={(e) => handleFilterAttivita(e.target.value)}
            className={filterSelectCls}
          >
            <option value="">Attività: Tutte</option>
            {filterActivityList.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 cursor-pointer"
          >
            <X size={14} /> Rimuovi filtri
          </button>
        )}
      </div>

      {/* Client filter banner */}
      {filterCliente && (() => {
        const cl = clientList.find(c => String(c.id) === String(filterCliente))
        return cl ? (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-teal-600" />
            </div>
            <span className="text-sm font-bold text-teal-900">{cl.nome_azienda}</span>
          </div>
        ) : null
      })()}

      {/* Compose Form */}
      {showCompose && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <h3 className="font-semibold mb-3">Componi Email</h3>
          <form onSubmit={handleCompose} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinatario (Cliente) *</label>
                <select
                  value={composeForm.cliente_id}
                  onChange={(e) => setComposeForm(f => ({ ...f, cliente_id: e.target.value }))}
                  required
                  className={selectCls}
                >
                  <option value="">Seleziona cliente...</option>
                  {clientList.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_azienda} — {c.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto *</label>
                <input
                  type="text"
                  value={composeForm.oggetto}
                  onChange={(e) => setComposeForm(f => ({ ...f, oggetto: e.target.value }))}
                  required
                  className={selectCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio *</label>
              <textarea
                value={composeForm.corpo}
                onChange={(e) => setComposeForm(f => ({ ...f, corpo: e.target.value }))}
                required
                rows={4}
                className={`${selectCls} resize-none`}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={sending}
                className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                <Send size={16} /> {sending ? 'Invio...' : 'Invia Email'}
              </button>
              <button type="button" onClick={() => setShowCompose(false)}
                className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-16rem)]">
        {/* Email List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          {/* Quick filter pills */}
          <div className="flex gap-1 px-3 pt-3 pb-2 border-b border-gray-100">
            {[
              { key: 'tutte', label: 'Tutte', count: filterCounts.tutte, active: 'bg-blue-100 text-blue-800', counter: 'bg-blue-200' },
              { key: 'da_leggere', label: 'Da leggere', count: filterCounts.da_leggere, active: 'bg-red-100 text-red-800', counter: 'bg-red-200' },
              { key: 'non_assegnate', label: 'Non assegnate', count: filterCounts.non_assegnate, active: 'bg-yellow-100 text-yellow-800', counter: 'bg-yellow-200' },
              { key: 'bloccanti', label: 'Bloccanti', count: filterCounts.bloccanti, active: 'bg-orange-100 text-orange-800', counter: 'bg-orange-200' },
              { key: 'rilevanti', label: 'Rilevanti', count: filterCounts.rilevanti, active: 'bg-purple-100 text-purple-800', counter: 'bg-purple-200' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setQuickFilter(f.key); setPage(1) }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  quickFilter === f.key ? f.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.label} <span className={`ml-0.5 px-1 py-0.5 rounded text-[10px] ${quickFilter === f.key ? f.counter : 'bg-gray-200'}`}>{f.count}</span>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-400">Caricamento...</div>
            ) : emailList.length === 0 ? (
              <div className="p-4 text-center text-gray-400">Nessuna email</div>
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {emailList.map(e => (
                    <button
                      key={e.id}
                      onClick={() => handleSelect(e)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        selected?.id === e.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      } ${!e.letta ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {e.letta ? (
                          <MailOpen size={14} className="text-gray-400 shrink-0" />
                        ) : (
                          <Mail size={14} className="text-blue-500 shrink-0" />
                        )}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tipoColors[e.tipo] || 'bg-gray-100 text-gray-600'}`}>
                          {tipoLabels[e.tipo] || e.tipo}
                        </span>
                        {e.is_bloccante ? (
                          <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                        ) : null}
                        {e.rilevanza === 'rilevante' && (
                          <Star size={14} className="text-purple-500 shrink-0" />
                        )}
                        {e.rilevanza === 'di_contesto' && (
                          <Info size={14} className="text-slate-400 shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm truncate ${!e.letta ? 'font-semibold' : 'font-medium'}`}>
                        {e.oggetto}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-400 truncate">{e.mittente}</p>
                        <p className="text-xs text-gray-400 shrink-0">
                          {new Date(e.data_ricezione).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      {e.cliente_nome && (
                        <p className="text-xs text-gray-400 mt-0.5">{e.cliente_nome}</p>
                      )}
                    </button>
                  ))}
                </div>
                <Pagination
                  page={page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  limit={pagination.limit}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </div>

        {/* Email Detail */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          {selected ? (
            <div className="overflow-y-auto flex-1">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.oggetto}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoColors[selected.tipo] || 'bg-gray-100 text-gray-600'}`}>
                        {tipoLabels[selected.tipo] || selected.tipo}
                      </span>
                      {selected.is_bloccante && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">
                          Bloccante
                        </span>
                      )}
                      {selected.rilevanza === 'rilevante' && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
                          <Star size={12} /> Rilevante
                        </span>
                      )}
                      {selected.rilevanza === 'di_contesto' && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                          <Info size={12} /> Di contesto
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowReply(!showReply); setReplyText('') }}
                      className="text-xs px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Reply size={14} /> Rispondi
                    </button>
                    <button
                      onClick={() => handleToggleBloccante(selected.id, selected.is_bloccante)}
                      className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer ${
                        selected.is_bloccante
                          ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {selected.is_bloccante ? 'Rimuovi blocco' : 'Marca bloccante'}
                    </button>
                    <button
                      onClick={() => handleSetRilevanza(selected.id, 'rilevante')}
                      className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer inline-flex items-center gap-1 ${
                        selected.rilevanza === 'rilevante'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Star size={14} /> Rilevante
                    </button>
                    <button
                      onClick={() => handleSetRilevanza(selected.id, 'di_contesto')}
                      className={`text-xs px-3 py-1.5 rounded-lg border cursor-pointer inline-flex items-center gap-1 ${
                        selected.rilevanza === 'di_contesto'
                          ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Info size={14} /> Di contesto
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mb-4">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Da</dt>
                      <dd className="font-medium">{selected.mittente}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">A</dt>
                      <dd className="font-medium">{selected.destinatario}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Data</dt>
                      <dd className="font-medium">{new Date(selected.data_ricezione).toLocaleString('it-IT')}</dd>
                    </div>
                    {selected.cliente_nome && (
                      <div>
                        <dt className="text-gray-500">Cliente</dt>
                        <dd className="font-medium">{selected.cliente_nome}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Assign to project + activity */}
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderKanban size={16} className="text-purple-500" />
                    <label className="text-sm font-medium text-gray-700">Progetto associato</label>
                  </div>
                  <select
                    value={selected.progetto_id || ''}
                    onChange={(e) => handleAssignProject(selected.id, e.target.value ? Number(e.target.value) : null)}
                    className={selectCls}
                  >
                    <option value="">Nessun progetto</option>
                    {projectList.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} — {p.cliente_nome}</option>
                    ))}
                  </select>

                  {/* Activity dropdown — only visible when a project is selected */}
                  {selected.progetto_id && (
                    <div className="mt-3">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Attività associata</label>
                      <select
                        value={selected.attivita_id || ''}
                        onChange={(e) => handleAssignActivity(selected.id, e.target.value ? Number(e.target.value) : null)}
                        className={selectCls}
                      >
                        <option value="">Nessuna attività</option>
                        {activityList.map(a => (
                          <option key={a.id} value={a.id}>{a.nome}{a.stato ? ` (${a.stato.replace('_', ' ')})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.corpo}</p>
                </div>

                {/* Thread */}
                {selected.thread && selected.thread.length > 1 && (
                  <div className="border-t border-gray-100 mt-6 pt-4">
                    <h3 className="text-sm font-semibold mb-3">Thread ({selected.thread.length} messaggi)</h3>
                    <div className="space-y-3">
                      {selected.thread.map(t => (
                        <div key={t.id} className={`p-3 rounded-lg ${t.id === selected.id ? 'bg-blue-50 border border-blue-200' : t.mittente.includes('@stmdomotica.it') ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium">{t.mittente.includes('@stmdomotica.it') ? 'Tu (admin)' : t.mittente}</p>
                            <p className="text-xs text-gray-400">{new Date(t.data_ricezione).toLocaleString('it-IT')}</p>
                          </div>
                          <p className="text-sm text-gray-600">{t.corpo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reply Form */}
                {showReply && (
                  <div className="border-t border-gray-100 mt-6 pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Reply size={16} className="text-blue-500" /> Rispondi a {selected.mittente}
                    </h3>
                    <form onSubmit={handleReply} className="space-y-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Scrivi la risposta..."
                        rows={4}
                        className={`${selectCls} resize-none`}
                      />
                      <div className="flex gap-2">
                        <button type="submit" disabled={sendingReply || !replyText.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                          <Send size={16} /> {sendingReply ? 'Invio...' : 'Invia Risposta'}
                        </button>
                        <button type="button" onClick={() => setShowReply(false)}
                          className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                          Annulla
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Seleziona un'email per visualizzarla
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
