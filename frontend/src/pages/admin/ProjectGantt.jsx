import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Phone, User, Plus, X, ChevronDown, ChevronRight, Star, Info, ExternalLink, Paperclip, FileText, Download, Upload, Trash2, Users, UserCog } from 'lucide-react'
import { projects, activities, users as usersApi, clients as clientsApi } from '../../api/client'
import GanttChart from '../../components/GanttChart'
import ProjectDataBox from '../../components/ProjectDataBox'

const projectStatusConfig = {
  chiuso: { label: 'Chiuso', classes: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  attivo: { label: 'Attivo', classes: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  bloccato: { label: 'Bloccato', classes: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  senza_attivita: { label: 'Senza attività', classes: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
}

function computeProjectStatus(attivita) {
  if (!attivita || attivita.length === 0) return 'senza_attivita'
  if (attivita.every(a => a.stato === 'completata')) return 'chiuso'
  if (attivita.some(a => a.stato === 'bloccata')) return 'bloccato'
  return 'attivo'
}

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

export default function ProjectGantt() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [userList, setUserList] = useState([])
  const [creating, setCreating] = useState(false)
  const [newAct, setNewAct] = useState({ nome: '', descrizione: '', priorita: 'media', data_inizio: '', data_scadenza: '', assegnato_a: '', dipende_da: '' })
  const [emailTab, setEmailTab] = useState('tutte')
  const [emailActFilter, setEmailActFilter] = useState(null)
  const [expandedEmails, setExpandedEmails] = useState({})
  const [showDesc, setShowDesc] = useState(false)
  const [showAllegati, setShowAllegati] = useState(false)
  const [showReferenti, setShowReferenti] = useState(false)
  const [showTecnici, setShowTecnici] = useState(false)
  const [showAddRef, setShowAddRef] = useState(false)
  const [showNewRefForm, setShowNewRefForm] = useState(false)
  const [clientReferenti, setClientReferenti] = useState([])
  const [newRefForm, setNewRefForm] = useState({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })
  const [allegati, setAllegati] = useState([])
  const [loadingAllegati, setLoadingAllegati] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const navigate = useNavigate()
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function loadProject() {
    projects.get(id)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function loadAllegati() {
    setLoadingAllegati(true)
    projects.allegati(id).then(setAllegati).catch(() => setAllegati([])).finally(() => setLoadingAllegati(false))
  }

  function toggleAllegati() {
    const willOpen = !showAllegati
    setShowAllegati(willOpen)
    if (willOpen && allegati.length === 0) loadAllegati()
  }

  async function handleUploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    setUploadingFiles(true)
    try {
      await projects.uploadAllegati(id, Array.from(fileList))
      loadAllegati()
    } catch (err) { alert(err.message) }
    finally { setUploadingFiles(false) }
  }

  async function handleDeleteAllegato(allegatoId) {
    if (!confirm('Eliminare questo allegato?')) return
    await projects.deleteAllegato(id, allegatoId).catch(err => alert(err.message))
    loadAllegati()
  }

  function handleDownloadAllegato(allegatoId, nome) {
    const token = sessionStorage.getItem('token')
    const url = projects.downloadAllegatoUrl(id, allegatoId)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = nome
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  function loadClientReferenti() {
    if (project?.cliente_id) {
      clientsApi.getReferenti(project.cliente_id)
        .then(data => setClientReferenti(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }

  function handleOpenAddRef() {
    setShowAddRef(true)
    setShowNewRefForm(false)
    loadClientReferenti()
  }

  async function handleAssignExisting(refId) {
    const currentIds = (project.referenti || []).map(r => r.id)
    if (currentIds.includes(refId)) return
    try {
      await projects.updateReferenti(id, { referenti: [...currentIds, refId] })
      loadProject()
      setShowAddRef(false)
    } catch (err) { alert(err.message) }
  }

  async function handleCreateAndAssign(e) {
    e.preventDefault()
    if (!newRefForm.nome.trim() || !newRefForm.email.trim()) return
    try {
      const currentIds = (project.referenti || []).map(r => r.id)
      await projects.updateReferenti(id, { referenti: currentIds, nuovi_referenti: [newRefForm] })
      setNewRefForm({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })
      setShowNewRefForm(false)
      setShowAddRef(false)
      loadProject()
    } catch (err) { alert(err.message) }
  }

  async function handleCreateAndAssign2(form) {
    if (!form.nome || !form.email) return
    try {
      const currentIds = (project.referenti || []).map(r => r.id)
      await projects.updateReferenti(id, { referenti: currentIds, nuovi_referenti: [form] })
      loadProject()
    } catch (err) { alert(err.message) }
  }

  async function handleRemoveRef(refId) {
    if (!confirm('Rimuovere questo referente dal progetto?')) return
    const currentIds = (project.referenti || []).map(r => r.id).filter(rid => rid !== refId)
    try {
      await projects.updateReferenti(id, { referenti: currentIds })
      loadProject()
    } catch (err) { alert(err.message) }
  }

  async function handleToggleTecnico(tecnicoId) {
    const current = project.tecnici || []
    const updated = current.includes(tecnicoId)
      ? current.filter(id => id !== tecnicoId)
      : [...current, tecnicoId]
    try {
      await projects.update(id, { tecnici: updated })
      loadProject()
    } catch (err) { alert(err.message) }
  }

  useEffect(() => {
    loadProject()
    if (isAdmin) usersApi.list().then(setUserList).catch(() => {})
  }, [id])

  async function handleCreateActivity(e) {
    e.preventDefault()
    if (!newAct.nome.trim()) return
    setCreating(true)
    try {
      await activities.create(id, {
        ...newAct,
        assegnato_a: newAct.assegnato_a ? Number(newAct.assegnato_a) : null,
        dipende_da: newAct.dipende_da ? Number(newAct.dipende_da) : null,
      })
      setNewAct({ nome: '', descrizione: '', priorita: 'media', data_inizio: '', data_scadenza: '', assegnato_a: '', dipende_da: '' })
      setShowNewActivity(false)
      loadProject()
    } catch (err) { alert(err.message) }
    finally { setCreating(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (!project) return <div className="text-center text-gray-400 py-12">Progetto non trovato</div>

  const tecnici = userList.filter(u => u.ruolo === 'tecnico' && u.attivo)
  const isTecnicoProgetto = !isAdmin && (project.tecnici || []).map(Number).includes(Number(currentUser.id))
  const canEdit = isAdmin || (isTecnicoProgetto && !!currentUser.gestione_avanzata)
  const computedStatus = computeProjectStatus(project.attivita)
  const statusCfg = projectStatusConfig[computedStatus]

  async function handleDeleteProject() {
    if (!confirm('Sei sicuro di voler eliminare questo progetto e tutte le sue attività? Questa azione è irreversibile.')) return
    try {
      await projects.delete(id)
      navigate('/admin/timeline')
    } catch (err) { alert(err.message) }
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <Link to="/admin/timeline" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Torna alla timeline
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold">Dettaglio Progetto : Gantt Chart</h1>
        <Link to={`/admin/projects/${id}`} className="text-sm text-blue-500 hover:text-blue-700 hover:underline whitespace-nowrap">Vai a dettaglio progetto</Link>
      </div>

      {/* Client Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
          <Building2 size={16} className="text-teal-600" />
        </div>
        <span className="text-sm font-bold text-teal-900">Cliente: {project.cliente_nome}</span>
      </div>

      {/* Box Dati Progetto */}
      <div className="space-y-4 mb-5">
      <ProjectDataBox
        project={project}
        isAdmin={isAdmin}
        canEdit={canEdit}
        onDelete={handleDeleteProject}
        onUpdateProject={async (data) => { await projects.update(id, data); loadProject() }}
        onCreateActivity={async (act) => {
          await activities.create(id, { ...act, assegnato_a: act.assegnato_a || null, dipende_da: act.dipende_da || null })
          loadProject()
        }}
        allegati={allegati}
        showAllegati={showAllegati}
        onToggleAllegati={toggleAllegati}
        onUploadFiles={handleUploadFiles}
        uploadingFiles={uploadingFiles}
        onDeleteAllegato={handleDeleteAllegato}
        clientReferenti={clientReferenti}
        onOpenAddRef={handleOpenAddRef}
        onRemoveRef={handleRemoveRef}
        onAssignExistingRef={handleAssignExisting}
        onCreateAndAssignRef={async (form) => { await handleCreateAndAssign2(form) }}
        tecnici={tecnici}
        onTecnicoToggle={handleToggleTecnico}
      />
      </div>


      {/* Gantt Chart */}
      <GanttChart
        attivita={project.attivita}
        projectStart={project.data_inizio}
        projectEnd={project.data_scadenza}
        projectId={id}
        scheduledActivities={project.attivita_programmate || []}
        onActivityUpdate={isAdmin ? async (activityId, updates) => {
          try {
            await activities.update(id, activityId, updates)
            loadProject()
          } catch (err) { alert(err.message) }
        } : null}
      />

      {/* Email Associate al Progetto */}
      {project.emails && project.emails.length > 0 && (() => {
        const allEmails = project.emails
        const bloccanti = allEmails.filter(e => e.is_bloccante)
        const rilevanti = allEmails.filter(e => e.rilevanza === 'rilevante')
        const contesto = allEmails.filter(e => e.rilevanza === 'di_contesto')
        const tabs = [
          { key: 'tutte', label: 'Tutte', count: allEmails.length, active: 'bg-blue-100 text-blue-800', counter: 'bg-blue-200' },
          { key: 'bloccanti', label: 'Bloccanti', count: bloccanti.length, active: 'bg-orange-100 text-orange-800', counter: 'bg-orange-200' },
          { key: 'rilevanti', label: 'Rilevanti', count: rilevanti.length, active: 'bg-purple-100 text-purple-800', counter: 'bg-purple-200' },
          { key: 'contesto', label: 'Di contesto', count: contesto.length, active: 'bg-slate-200 text-slate-800', counter: 'bg-slate-300' },
        ]
        let filtered = emailTab === 'bloccanti' ? bloccanti
          : emailTab === 'rilevanti' ? rilevanti
          : emailTab === 'contesto' ? contesto
          : allEmails
        if (emailActFilter) filtered = filtered.filter(e => e.attivita_id === emailActFilter)
        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-5">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Mail size={18} className="text-blue-500" />
              <h2 className="text-lg font-semibold">Email Associate</h2>
              <span className="text-xs text-gray-400">({allEmails.length})</span>
            </div>
            <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-100">
              {tabs.map(t => (
                <button key={t.key} onClick={() => { setEmailTab(t.key); setEmailActFilter(null) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    emailTab === t.key ? t.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {t.label} <span className={`ml-1 px-1 py-0.5 rounded text-xs ${emailTab === t.key ? t.counter : 'bg-gray-200'}`}>{t.count}</span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                {(project.attivita || []).map(a => {
                  const hasEmails = allEmails.some(e => e.attivita_id === a.id)
                  if (!hasEmails || !a.ordine) return null
                  return (
                    <button key={a.id} onClick={() => setEmailActFilter(emailActFilter === a.id ? null : a.id)}
                      title={a.nome}
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                        emailActFilter === a.id
                          ? 'bg-blue-600 text-white ring-2 ring-blue-300 scale-110'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:scale-105'
                      }`}>
                      {a.ordine || '?'}
                    </button>
                  )
                })}
                {emailActFilter && (
                  <button onClick={() => setEmailActFilter(null)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer ml-1">tutte</button>
                )}
              </div>
            </div>
            {filtered.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {filtered.map(e => (
                  <div key={e.id} className={`p-4 ${e.is_bloccante ? 'bg-orange-50/50 border-l-4 border-l-orange-400' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedEmails(prev => ({ ...prev, [e.id]: !prev[e.id] }))} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                          {expandedEmails[e.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <p className="text-sm font-medium">
                          {e.oggetto}
                          {e.is_bloccante && <span className="ml-2 text-xs text-orange-600 font-medium">BLOCCANTE</span>}
                          {e.rilevanza === 'rilevante' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-purple-600 font-medium"><Star size={11} /> RILEVANTE</span>}
                          {e.rilevanza === 'di_contesto' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-500 font-medium"><Info size={11} /> DI CONTESTO</span>}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-gray-400">{new Date(e.data_ricezione).toLocaleString('it-IT')}</p>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">{e.mittente} → {e.destinatario}</p>
                    {e.attivita_nome && (
                      <p className="text-xs text-orange-600 font-medium ml-6 mt-1">Attività: {e.attivita_nome}</p>
                    )}
                    {expandedEmails[e.id] && e.corpo && (
                      <div className="mt-2 ml-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{e.corpo}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-400">Nessuna email in questa categoria</div>
            )}
          </div>
        )
      })()}

      {/* Modal Nuova Attività */}
      {showNewActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewActivity(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold">Nuova Attività</h2>
              <button onClick={() => setShowNewActivity(false)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateActivity} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={newAct.nome}
                  onChange={(e) => setNewAct(p => ({ ...p, nome: e.target.value }))}
                  className={selectCls}
                  placeholder="Nome dell'attività"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea
                  value={newAct.descrizione}
                  onChange={(e) => setNewAct(p => ({ ...p, descrizione: e.target.value }))}
                  className={`${selectCls} resize-none`}
                  rows={3}
                  placeholder="Descrizione opzionale..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
                  <select
                    value={newAct.priorita}
                    onChange={(e) => setNewAct(p => ({ ...p, priorita: e.target.value }))}
                    className={selectCls}
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="bassa">Bassa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assegnato a</label>
                  <select
                    value={newAct.assegnato_a}
                    onChange={(e) => setNewAct(p => ({ ...p, assegnato_a: e.target.value }))}
                    className={selectCls}
                  >
                    <option value="">Non assegnato</option>
                    {tecnici.map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                  <input
                    type="date"
                    value={newAct.data_inizio}
                    onChange={(e) => setNewAct(p => ({ ...p, data_inizio: e.target.value }))}
                    className={selectCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                  <input
                    type="date"
                    value={newAct.data_scadenza}
                    onChange={(e) => setNewAct(p => ({ ...p, data_scadenza: e.target.value }))}
                    className={selectCls}
                  />
                </div>
              </div>
              {project.attivita.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dipende da</label>
                  <select
                    value={newAct.dipende_da}
                    onChange={(e) => setNewAct(p => ({ ...p, dipende_da: e.target.value }))}
                    className={selectCls}
                  >
                    <option value="">Nessuna dipendenza</option>
                    {project.attivita.map(a => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewActivity(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={creating || !newAct.nome.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Plus size={16} /> {creating ? 'Creazione...' : 'Crea Attività'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
