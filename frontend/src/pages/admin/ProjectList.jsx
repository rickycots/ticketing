import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MessageCircle, Building2, UserPlus, X, Users } from 'lucide-react'
import { projects, clients as clientsApi, users } from '../../api/client'
import Pagination from '../../components/Pagination'
import HelpTip from '../../components/HelpTip'
import ProjectMiniBox from '../../components/ProjectMiniBox'

const statoColors = {
  attivo: 'bg-green-100 text-green-800',
  in_pausa: 'bg-yellow-100 text-yellow-800',
  completato: 'bg-blue-100 text-blue-800',
  annullato: 'bg-gray-100 text-gray-600',
}

const bloccoLabels = {
  nessuno: null,
  lato_admin: 'In lavorazione',
  lato_cliente: 'In attesa del cliente',
}

const bloccoColors = {
  lato_admin: 'bg-blue-50 text-blue-700 border border-blue-200',
  lato_cliente: 'bg-orange-50 text-orange-700 border border-orange-200',
}

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

export default function ProjectList() {
  const [projectList, setProjectList] = useState([])
  const [clientList, setClientList] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', nome: '', descrizione: '', data_inizio: '', data_scadenza: '', tecnici: [], referenti: [], nuovi_referenti: [], singola_attivita: false })
  const [creating, setCreating] = useState(false)
  const [clientReferenti, setClientReferenti] = useState([])
  const [showNewRef, setShowNewRef] = useState(false)
  const [newRefForm, setNewRefForm] = useState({ nome: '', cognome: '', email: '' })
  const [manutenzioneOrdinaria, setManutenzioneOrdinaria] = useState(false)
  const [activeTab, setActiveTab] = useState('aperti')
  const [filterCliente, setFilterCliente] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 })
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function loadProjects() {
    setLoading(true)
    const params = { page }
    if (filterCliente) params.cliente_id = filterCliente
    projects.list(params).then(res => {
      setProjectList(res.data)
      setPagination({ total: res.total, totalPages: res.totalPages, limit: res.limit })
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProjects()
  }, [page, filterCliente])

  useEffect(() => {
    if (isAdmin) {
      clientsApi.list({ limit: 1000 }).then(res => setClientList(res.data || [])).catch(console.error)
      users.list().then(setUserList).catch(console.error)
    }
  }, [])

  const tecnici = userList.filter(u => u.ruolo === 'tecnico' && u.attivo)

  const progettiAperti = projectList.filter(p => p.stato === 'attivo' || p.stato === 'in_pausa')
  const progettiCompletati = projectList.filter(p => p.stato === 'completato' || p.stato === 'annullato')
  const visibleProjects = activeTab === 'aperti' ? progettiAperti : progettiCompletati

  function handleTecnicoToggle(uid) {
    setForm(f => ({
      ...f,
      tecnici: f.tecnici.includes(uid)
        ? f.tecnici.filter(id => id !== uid)
        : [...f.tecnici, uid]
    }))
  }

  // Load referenti when client changes
  useEffect(() => {
    setClientReferenti([])
    if (form.cliente_id) {
      clientsApi.getReferenti(form.cliente_id)
        .then(data => setClientReferenti(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [form.cliente_id])

  function handleRefToggle(refId) {
    setForm(f => ({
      ...f,
      referenti: f.referenti.includes(refId)
        ? f.referenti.filter(id => id !== refId)
        : [...f.referenti, refId]
    }))
  }

  function addNewReferente() {
    if (!newRefForm.nome.trim() || !newRefForm.email.trim()) return
    setForm(f => ({ ...f, nuovi_referenti: [...f.nuovi_referenti, { ...newRefForm }] }))
    setNewRefForm({ nome: '', cognome: '', email: '' })
    setShowNewRef(false)
  }

  function removeNewReferente(idx) {
    setForm(f => ({ ...f, nuovi_referenti: f.nuovi_referenti.filter((_, i) => i !== idx) }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    const hasReferenti = form.referenti.length > 0 || form.nuovi_referenti.length > 0
    if (!manutenzioneOrdinaria && !hasReferenti) {
      alert('Seleziona almeno un referente, oppure spunta "STM Manutenzione Ordinaria".')
      return
    }
    setCreating(true)
    try {
    await projects.create({ ...form, cliente_id: Number(form.cliente_id), manutenzione_ordinaria: manutenzioneOrdinaria })
    setForm({ cliente_id: '', nome: '', descrizione: '', data_inizio: '', data_scadenza: '', tecnici: [], referenti: [], nuovi_referenti: [], singola_attivita: false })
    setShowForm(false)
    setClientReferenti([])
    setShowNewRef(false)
    setManutenzioneOrdinaria(false)
    loadProjects()
    } catch (err) { alert(err.message) }
    finally { setCreating(false) }
  }

  function getTecniciNames(ids) {
    if (!ids || ids.length === 0) return null
    return ids.map(id => {
      const u = userList.find(u => u.id === id)
      return u ? u.nome.split(' ').map(p => p[0]).join('').toUpperCase() : '?'
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {isAdmin ? 'Progetti' : <>Progetti di cui hai visibilità <HelpTip text="Per ogni progetto l'admin può scegliere i tecnici abilitati; essi potranno averne visibilità generale ma lavorare solo sulle attività a loro assegnate." /></>}
        </h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Nuovo Progetto
          </button>
        )}
      </div>

      {/* New Project Modal */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold">Nuovo Progetto</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Manutenzione Ordinaria — sempre visibile in alto */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={manutenzioneOrdinaria} onChange={e => setManutenzioneOrdinaria(e.target.checked)}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                <span className="text-sm font-medium text-gray-700">STM Manutenzione Ordinaria</span>
                <HelpTip size={13} text="Se selezionato stabilisce che il progetto è stato creato in autonomia da STM. I referenti diventano opzionali." />
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select value={form.cliente_id} onChange={(e) => setForm(f => ({ ...f, cliente_id: e.target.value, referenti: [], nuovi_referenti: [] }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" required>
                  <option value="">Seleziona cliente...</option>
                  {clientList.map(c => <option key={c.id} value={c.id}>{c.nome_azienda}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Progetto *</label>
                <input type="text" value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Nome del progetto" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea value={form.descrizione} onChange={(e) => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" rows={2} placeholder="Descrizione opzionale..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.singola_attivita} onChange={e => setForm(f => ({ ...f, singola_attivita: e.target.checked }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Progetto singola attività</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                  <input type="date" value={form.data_inizio} onChange={(e) => setForm(f => ({ ...f, data_inizio: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                  <input type="date" value={form.data_scadenza} onChange={(e) => setForm(f => ({ ...f, data_scadenza: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              {/* Tecnici + Referenti su due colonne */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tecnici Assegnati</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {userList.filter(u => u.ruolo === 'tecnico' && u.attivo).map(u => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                        <input type="checkbox" checked={form.tecnici.includes(u.id)}
                          onChange={(e) => setForm(f => ({ ...f, tecnici: e.target.checked ? [...f.tecnici, u.id] : f.tecnici.filter(id => id !== u.id) }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">{u.nome}</span>
                      </label>
                    ))}
                    {userList.filter(u => u.ruolo === 'tecnico' && u.attivo).length === 0 && <p className="text-xs text-gray-400">Nessun tecnico disponibile</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Users size={16} /> Referenti Progetto {!manutenzioneOrdinaria && <span className="text-red-500">*</span>}
                  </label>
                  <div className={`border rounded-lg p-3 max-h-48 overflow-y-auto ${!form.cliente_id ? 'bg-gray-50 border-gray-200' : !manutenzioneOrdinaria && form.referenti.length === 0 && form.nuovi_referenti.length === 0 ? 'bg-teal-50 border-red-300' : 'bg-teal-50 border-teal-200'}`}>
                    {!form.cliente_id ? (
                      <p className="text-xs text-gray-400 italic">Seleziona un cliente per vedere i referenti</p>
                    ) : (
                      <>
                        {clientReferenti.length > 0 && clientReferenti.length <= 4 && (
                          <div className="space-y-1.5 mb-2">
                            {clientReferenti.map(r => (
                              <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-teal-100/50 rounded px-1 py-0.5">
                                <input type="checkbox" checked={form.referenti.includes(r.id)}
                                  onChange={() => handleRefToggle(r.id)}
                                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                <span className="text-sm text-gray-700">{r.nome} {r.cognome}</span>
                                <span className="text-xs text-gray-400">({r.email})</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {clientReferenti.length > 4 && (
                          <div className="mb-2">
                            <select multiple value={form.referenti.map(String)}
                              onChange={e => {
                                const selected = Array.from(e.target.selectedOptions, o => Number(o.value))
                                setForm(f => ({ ...f, referenti: selected }))
                              }}
                              className="w-full rounded border border-gray-300 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              size={Math.min(clientReferenti.length, 6)}>
                              {clientReferenti.map(r => (
                                <option key={r.id} value={r.id}>{r.nome} {r.cognome} ({r.email})</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">Tieni premuto Ctrl per selezione multipla</p>
                          </div>
                        )}
                        {form.nuovi_referenti.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {form.nuovi_referenti.map((nr, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs">
                                {nr.nome} ({nr.email})
                                <button type="button" onClick={() => removeNewReferente(idx)} className="hover:text-red-600 cursor-pointer"><X size={12} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        {showNewRef ? (
                          <div className="bg-white rounded p-2 border border-gray-200 space-y-1.5">
                            <input type="text" placeholder="Nome *" value={newRefForm.nome} onChange={e => setNewRefForm(f => ({ ...f, nome: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none" />
                            <input type="text" placeholder="Cognome" value={newRefForm.cognome} onChange={e => setNewRefForm(f => ({ ...f, cognome: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none" />
                            <input type="email" placeholder="Email *" value={newRefForm.email} onChange={e => setNewRefForm(f => ({ ...f, email: e.target.value }))}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none" />
                            <div className="flex gap-1.5">
                              <button type="button" onClick={addNewReferente} className="bg-teal-600 text-white rounded px-2 py-1 text-xs font-medium hover:bg-teal-700 cursor-pointer">Aggiungi</button>
                              <button type="button" onClick={() => setShowNewRef(false)} className="bg-gray-100 text-gray-700 rounded px-2 py-1 text-xs hover:bg-gray-200 cursor-pointer">Annulla</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setShowNewRef(true)}
                            className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 cursor-pointer mt-1">
                            <UserPlus size={14} /> Nuovo referente
                          </button>
                        )}
                        {clientReferenti.length === 0 && form.nuovi_referenti.length === 0 && !showNewRef && (
                          <p className="text-xs text-gray-400 italic mt-1">Nessun referente per questo cliente</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">Annulla</button>
                <button type="submit" disabled={creating || !form.cliente_id || !form.nome.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  <Plus size={16} /> {creating ? 'Creazione...' : 'Crea Progetto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs + Filter */}
      <div className="flex items-end justify-between mb-4 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('aperti')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'aperti'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Aperti <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'aperti' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{progettiAperti.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('completati')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'completati'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Completati <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'completati' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{progettiCompletati.length}</span>
          </button>
        </div>
        {isAdmin && clientList.length > 0 && (
          <div className="pb-2">
            <select
              value={filterCliente}
              onChange={(e) => { setFilterCliente(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tutti i clienti</option>
              {clientList.map(c => (
                <option key={c.id} value={c.id}>{c.nome_azienda}</option>
              ))}
            </select>
          </div>
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

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : visibleProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {activeTab === 'aperti' ? 'Nessun progetto aperto' : 'Nessun progetto completato'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map(p => (
            <ProjectMiniBox key={p.id} project={p} to={`/admin/projects/${p.id}`} isAdmin={isAdmin} getTecniciNames={getTecniciNames} />
          ))}
        </div>
      )}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
