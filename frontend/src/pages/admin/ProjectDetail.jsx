import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Mail, StickyNote, Trash2, Users, ChevronRight, ChevronDown, MessageCircle, Send, Paperclip, ExternalLink, Lock, BellRing, Building2, Phone, User, Star, Info, FileText, Download, Upload, X } from 'lucide-react'
import { projects, activities, users } from '../../api/client'

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

const actStatoColors = {
  da_fare: 'bg-gray-100 text-gray-700',
  in_corso: 'bg-blue-100 text-blue-700',
  completata: 'bg-green-100 text-green-700',
  bloccata: 'bg-red-100 text-red-700',
}

const actStatoLabels = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  completata: 'Completata',
  bloccata: 'Bloccata',
}

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [newActivity, setNewActivity] = useState({ nome: '', descrizione: '', priorita: 'media', data_scadenza: '', assegnato_a: '', data_inizio: '', ordine: '', dipende_da: '' })
  const [userList, setUserList] = useState([])
  const [expandedNotes, setExpandedNotes] = useState({})
  const [newNoteText, setNewNoteText] = useState({})
  const [chatText, setChatText] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const [editDescrizione, setEditDescrizione] = useState('')
  const [expandedEmails, setExpandedEmails] = useState({})
  const [showAllegati, setShowAllegati] = useState(false)
  const [showReferenti, setShowReferenti] = useState(false)
  const [allegati, setAllegati] = useState([])
  const [loadingAllegati, setLoadingAllegati] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [mainTab, setMainTab] = useState('attivita')
  const [actFilter, setActFilter] = useState('attive')
  const [emailFilter, setEmailFilter] = useState('tutte')
  const [emailDir, setEmailDir] = useState('ricevute')
  const chatEndRef = useRef(null)
  const navigate = useNavigate()
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function load() {
    projects.get(id).then(p => { setProject(p); setEditDescrizione(p.descrizione || '') }).catch(console.error).finally(() => setLoading(false))
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

  useEffect(() => {
    load()
    if (isAdmin) users.list().then(setUserList).catch(() => {})
  }, [id])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [project?.chat?.length])

  const tecnici = userList.filter(u => u.ruolo === 'tecnico' && u.attivo)

  async function handleCreateActivity(e) {
    e.preventDefault()
    await activities.create(id, {
      ...newActivity,
      assegnato_a: newActivity.assegnato_a ? Number(newActivity.assegnato_a) : null,
      ordine: newActivity.ordine !== '' ? Number(newActivity.ordine) : null,
      dipende_da: newActivity.dipende_da ? Number(newActivity.dipende_da) : null,
    })
    setNewActivity({ nome: '', descrizione: '', priorita: 'media', data_scadenza: '', assegnato_a: '', data_inizio: '', ordine: '', dipende_da: '' })
    setShowNewActivity(false)
    load()
  }

  async function handleUpdateActivity(actId, data) {
    await activities.update(id, actId, data)
    load()
  }

  async function handleDeleteActivity(actId) {
    if (!confirm('Eliminare questa attività?')) return
    await activities.delete(id, actId)
    load()
  }

  async function handleStatusChange(newStato) {
    await projects.update(id, { stato: newStato })
    load()
  }

  async function handleBloccoChange(newBlocco) {
    await projects.update(id, {
      blocco: newBlocco,
      email_bloccante_id: newBlocco === 'nessuno' ? null : project.email_bloccante_id,
    })
    load()
  }

  function toggleNote(actId) {
    setExpandedNotes(prev => ({ ...prev, [actId]: !prev[actId] }))
  }

  function canEditActivity(activity) {
    if (isAdmin) return true
    return activity.assegnato_a === currentUser.id
  }

  async function handleAddNote(actId) {
    const testo = newNoteText[actId]
    if (!testo || !testo.trim()) return
    await activities.addNote(id, actId, testo.trim())
    setNewNoteText(prev => ({ ...prev, [actId]: '' }))
    load()
  }

  async function handleSendChat(e) {
    e.preventDefault()
    if (!chatText.trim() || sendingChat) return
    setSendingChat(true)
    try {
      await projects.sendChat(id, chatText.trim())
      setChatText('')
      load()
    } catch (err) { console.error(err) }
    finally { setSendingChat(false) }
  }

  function handleTecnicoToggle(uid) {
    const current = project.tecnici || []
    const updated = current.includes(uid)
      ? current.filter(id => id !== uid)
      : [...current, uid]
    projects.update(id, { tecnici: updated }).then(() => load())
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (!project) return <div className="text-center text-gray-400 py-12">Progetto non trovato</div>

  const attAperte = project.attivita.filter(a => a.stato !== 'completata').length
  const attCompletate = project.attivita.filter(a => a.stato === 'completata').length
  const computedStatus = computeProjectStatus(project.attivita)
  const statusCfg = projectStatusConfig[computedStatus]

  async function handleDeleteProject() {
    if (!confirm('Sei sicuro di voler eliminare questo progetto e tutte le sue attività? Questa azione è irreversibile.')) return
    try {
      await projects.delete(id)
      navigate('/admin/timeline')
    } catch (err) { alert(err.message) }
  }
  const emailsProgetto = (project.emails || []).filter(e => !e.attivita_id)
  const emailsAttivita = (project.emails || []).filter(e => e.attivita_id)

  function toggleEmail(emailId) {
    setExpandedEmails(prev => ({ ...prev, [emailId]: !prev[emailId] }))
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Link to="/admin/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Torna ai progetti
        </Link>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100 text-orange-800 px-3 py-1.5 text-sm font-semibold">
            Attività aperte <span className="bg-orange-200 rounded-md px-1.5 py-0.5 text-xs">{attAperte}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 text-green-800 px-3 py-1.5 text-sm font-semibold">
            Attività completate <span className="bg-green-200 rounded-md px-1.5 py-0.5 text-xs">{attCompletate}</span>
          </span>
        </div>
      </div>

      {/* Client Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-teal-900">{project.cliente_nome}</h2>
            {(project.cliente_email || project.cliente_telefono || project.cliente_referente) && (
              <div className="flex items-center gap-4 text-sm text-teal-700 mt-0.5">
                {project.cliente_email && <span className="flex items-center gap-1"><Mail size={13} /> {project.cliente_email}</span>}
                {project.cliente_telefono && <span className="flex items-center gap-1"><Phone size={13} /> {project.cliente_telefono}</span>}
                {project.cliente_referente && <span className="flex items-center gap-1"><User size={13} /> {project.cliente_referente}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{project.nome}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.classes}`}>
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
                {isAdmin && (
                  <button
                    onClick={handleDeleteProject}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Elimina progetto"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Avanzamento</span>
                <span className="font-semibold">{project.avanzamento}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${project.avanzamento}%` }} />
              </div>
            </div>

            <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
              {project.data_scadenza && <span>Fine prevista: {new Date(project.data_scadenza).toLocaleDateString('it-IT')}</span>}
              <span>{project.attivita.length} attività</span>
              <span className="font-bold text-gray-700">Ultimo aggiornamento: {new Date(project.updated_at).toLocaleString('it-IT')}</span>
            </div>

            {/* Toggle buttons row */}
            <div className="flex items-center gap-4 mt-4 border-t border-gray-100 pt-3">
              {project.descrizione && (
                <button
                  onClick={() => setEditDescrizione(editDescrizione ? '' : 'show')}
                  className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${editDescrizione ? 'text-gray-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ChevronRight size={14} className={`transition-transform ${editDescrizione ? 'rotate-90' : ''}`} />
                  <span className="font-medium">Descrizione Breve</span>
                </button>
              )}
              <button
                onClick={toggleAllegati}
                className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${showAllegati ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Paperclip size={15} className={showAllegati ? 'text-blue-500' : ''} />
                <span className="font-medium">Allegati Progetto</span>
                {allegati.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{allegati.length}</span>
                )}
              </button>
              <button
                onClick={() => setShowReferenti(prev => !prev)}
                className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${showReferenti ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <ChevronRight size={14} className={`transition-transform ${showReferenti ? 'rotate-90' : ''}`} />
                <Users size={14} className={showReferenti ? 'text-teal-500' : ''} />
                <span className="font-medium">Referenti</span>
                <span className="bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{(project.referenti || []).length}</span>
              </button>
              {!!project.manutenzione_ordinaria && <span className="ml-auto text-sm font-bold text-blue-600">STM Manutenzione Ordinaria</span>}
            </div>

            {/* Expanded description */}
            {editDescrizione && project.descrizione && (
              <div className="mt-2 pl-5 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {project.descrizione}
              </div>
            )}

              {showAllegati && (
                <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  {/* Upload area (admin only) */}
                  {isAdmin && (
                    <div className="p-3 border-b border-gray-200">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
                        <Upload size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {uploadingFiles ? 'Caricamento...' : 'Carica allegati (clicca o trascina)'}
                        </span>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          disabled={uploadingFiles}
                          onChange={e => handleUploadFiles(e.target.files)}
                        />
                      </label>
                    </div>
                  )}

                  {loadingAllegati ? (
                    <div className="p-4 text-center text-xs text-gray-400">Caricamento...</div>
                  ) : allegati.length === 0 ? (
                    <div className="p-4 text-center">
                      <FileText size={24} className="text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Nessun allegato</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {allegati.map(a => (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white transition-colors">
                          <FileText size={18} className={
                            a.tipo_mime?.includes('pdf') ? 'text-red-500'
                            : a.tipo_mime?.includes('image') ? 'text-blue-500'
                            : a.tipo_mime?.includes('word') || a.tipo_mime?.includes('document') ? 'text-blue-600'
                            : a.tipo_mime?.includes('sheet') || a.tipo_mime?.includes('excel') ? 'text-green-600'
                            : 'text-gray-400'
                          } />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{a.nome_originale}</p>
                            <p className="text-[11px] text-gray-400">
                              {a.dimensione < 1024 ? a.dimensione + ' B' : a.dimensione < 1048576 ? (a.dimensione / 1024).toFixed(1) + ' KB' : (a.dimensione / 1048576).toFixed(1) + ' MB'}
                              {' '}&middot; {new Date(a.created_at).toLocaleDateString('it-IT')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadAllegato(a.id, a.nome_originale)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
                          >
                            <Download size={13} /> Scarica
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteAllegato(a.id)}
                              className="text-gray-400 hover:text-red-600 cursor-pointer p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                              title="Elimina"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {/* Expanded referenti */}
            {showReferenti && (
              <div className="mt-3 bg-teal-50 rounded-lg border border-teal-200 overflow-hidden">
                {(!project.referenti || project.referenti.length === 0) ? (
                  <p className="px-4 py-3 text-sm text-gray-400 italic">Nessun referente assegnato</p>
                ) : (
                  <div className="divide-y divide-teal-100">
                    {project.referenti.map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-teal-700">
                            {(r.nome?.[0] || '').toUpperCase()}{(r.cognome?.[0] || '').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{r.nome} {r.cognome}</p>
                          <p className="text-xs text-gray-500">{r.email}{r.telefono ? ` · ${r.telefono}` : ''}</p>
                        </div>
                        {r.ruolo && (
                          <span className="text-xs text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">{r.ruolo}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs: Attività / Email Progetto / Email Attività */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => { setMainTab('attivita'); setEmailFilter('tutte') }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    mainTab === 'attivita'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Attività <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${mainTab === 'attivita' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{project.attivita.length}</span>
                </button>
                <button
                  onClick={() => { setMainTab('email'); setEmailFilter('tutte') }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    mainTab === 'email'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Email Progetto <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${mainTab === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{emailsProgetto.length}</span>
                </button>
                <button
                  onClick={() => { setMainTab('email_attivita'); setEmailFilter('tutte') }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    mainTab === 'email_attivita'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Email Attività <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${mainTab === 'email_attivita' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{emailsAttivita.length}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 mr-4">
                {mainTab === 'attivita' && isAdmin && (
                  <button
                    onClick={() => setShowNewActivity(!showNewActivity)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <Plus size={16} /> Aggiungi
                  </button>
                )}
                {(mainTab === 'email' || mainTab === 'email_attivita') && (
                  <Link
                    to={`/admin/send-mail?progetto_id=${project.id}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <Send size={14} /> Invia Mail
                  </Link>
                )}
              </div>
            </div>

            {/* ===== TAB ATTIVITÀ ===== */}
            {mainTab === 'attivita' && (
              <>
                {/* Sub-filter: Attive / Completate */}
                <div className="flex gap-1 px-4 pt-3 pb-2">
                  <button
                    onClick={() => setActFilter('attive')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      actFilter === 'attive'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Attive <span className={`ml-1 px-1 py-0.5 rounded text-xs ${actFilter === 'attive' ? 'bg-orange-200' : 'bg-gray-200'}`}>{attAperte}</span>
                  </button>
                  <button
                    onClick={() => setActFilter('completate')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      actFilter === 'completate'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Completate <span className={`ml-1 px-1 py-0.5 rounded text-xs ${actFilter === 'completate' ? 'bg-green-200' : 'bg-gray-200'}`}>{attCompletate}</span>
                  </button>
                </div>

                {/* New Activity Form */}
                {showNewActivity && isAdmin && (
                  <form onSubmit={handleCreateActivity} className="p-4 border-b border-gray-100 bg-blue-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        placeholder="Titolo attività *"
                        value={newActivity.nome}
                        onChange={(e) => setNewActivity(a => ({ ...a, nome: e.target.value }))}
                        required
                        className={selectCls}
                      />
                      <select
                        value={newActivity.assegnato_a}
                        onChange={(e) => setNewActivity(a => ({ ...a, assegnato_a: e.target.value }))}
                        className={selectCls}
                      >
                        <option value="">Assegna a...</option>
                        {userList.filter(u => u.attivo).map(u => (
                          <option key={u.id} value={u.id}>{u.nome} ({u.ruolo})</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <textarea
                        placeholder="Descrizione (opzionale)"
                        value={newActivity.descrizione}
                        onChange={(e) => setNewActivity(a => ({ ...a, descrizione: e.target.value }))}
                        rows={2}
                        className={selectCls + " resize-y"}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={newActivity.priorita}
                        onChange={(e) => setNewActivity(a => ({ ...a, priorita: e.target.value }))}
                        className={selectCls}
                      >
                        <option value="alta">Priorità Alta</option>
                        <option value="media">Priorità Media</option>
                        <option value="bassa">Priorità Bassa</option>
                      </select>
                      <div>
                        <input
                          type="date"
                          value={newActivity.data_scadenza}
                          onChange={(e) => setNewActivity(a => ({ ...a, data_scadenza: e.target.value }))}
                          className={selectCls}
                          title="Data Fine Prevista"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">Data Fine Prevista</p>
                      </div>
                      <div>
                        <input
                          type="date"
                          value={newActivity.data_inizio}
                          onChange={(e) => setNewActivity(a => ({ ...a, data_inizio: e.target.value }))}
                          className={selectCls}
                          title="Data Inizio"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">Data Inizio</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      {!newActivity.dipende_da && (
                        <div>
                          <input
                            type="number"
                            min="0"
                            placeholder="Ordine"
                            value={newActivity.ordine}
                            onChange={(e) => setNewActivity(a => ({ ...a, ordine: e.target.value }))}
                            className={selectCls}
                          />
                          <p className="text-xs text-gray-400 mt-0.5">Ordine (auto se vuoto)</p>
                        </div>
                      )}
                      <select
                        value={newActivity.dipende_da}
                        onChange={(e) => setNewActivity(a => ({ ...a, dipende_da: e.target.value }))}
                        className={selectCls}
                      >
                        <option value="">Nessuna dipendenza</option>
                        {(project?.attivita || []).map(att => (
                          <option key={att.id} value={att.id}>#{att.ordine || att.id} - {att.nome}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 cursor-pointer">
                          Crea
                        </button>
                        <button type="button" onClick={() => setShowNewActivity(false)} className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                          Annulla
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Activity List */}
                <div className="divide-y-2 divide-gray-200">
                  {(() => {
                    const filteredAtt = actFilter === 'attive'
                      ? project.attivita.filter(a => a.stato !== 'completata')
                      : project.attivita.filter(a => a.stato === 'completata')
                    if (filteredAtt.length === 0) return (
                      <p className="p-4 text-sm text-gray-400">
                        {actFilter === 'attive' ? 'Nessuna attività attiva' : 'Nessuna attività completata'}
                      </p>
                    )
                    // Build tree: roots sorted by ordine, dependents nested under parent
                    function buildTree(list) {
                      const ids = new Set(list.map(a => a.id))
                      // Root = no dependency OR parent not in filtered list
                      const roots = list.filter(a => !a.dipende_da || !ids.has(a.dipende_da)).sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
                      const result = []
                      function addWithChildren(parent, depth) {
                        result.push({ ...parent, _depth: depth })
                        list.filter(a => a.dipende_da == parent.id).forEach(c => addWithChildren(c, depth + 1))
                      }
                      roots.forEach(r => addWithChildren(r, 0))
                      // Safety: any remaining orphans
                      const added = new Set(result.map(r => r.id))
                      list.filter(a => !added.has(a.id)).forEach(a => result.push({ ...a, _depth: 0 }))
                      return result
                    }
                    const treeAtt = buildTree(filteredAtt)
                    return treeAtt.map(a => {
                      const isExpanded = expandedNotes[a.id]
                      const canEdit = canEditActivity(a)
                      const isCompleted = a.stato === 'completata'
                      const noteList = a.note_attivita || []
                      const noteCount = noteList.length
                      const statoBorder = {
                        da_fare: 'border-l-4 border-l-yellow-400',
                        in_corso: 'border-l-4 border-l-blue-500',
                        completata: 'border-l-4 border-l-green-400',
                        bloccata: 'border-l-4 border-l-red-400',
                      }

                      return (
                        <div key={a.id} className={`p-4 ${statoBorder[a.stato] || ''} ${isCompleted ? 'bg-green-50/40' : ''}`} style={a._depth ? { marginLeft: `${a._depth * 2}rem` } : undefined}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-3">
                              {!a.dipende_da ? (
                                <span className="w-5 h-5 rounded bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">
                                  {a.ordine || '—'}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">↳</span>
                              )}
                              <h4 className="text-sm font-semibold">{a.nome}</h4>
                              <Link to={`/admin/projects/${id}/activities/${a.id}`} className="text-xs text-blue-500 hover:text-blue-700 hover:underline whitespace-nowrap">
                                Dettaglio attività
                              </Link>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actStatoColors[a.stato]}`}>
                                {actStatoLabels[a.stato]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEdit && !a.email_bloccante && (
                                <select
                                  value={a.stato}
                                  onChange={(e) => handleUpdateActivity(a.id, { stato: e.target.value })}
                                  className="rounded border border-gray-200 px-2 py-1 text-xs"
                                >
                                  {Object.entries(actStatoLabels).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                  ))}
                                </select>
                              )}
                              {a.email_bloccante && (
                                <span
                                  title="Consulta la mail bloccante dal tab Email Attività e poi segui il suo thread per sbloccarla"
                                  className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 cursor-help"
                                >
                                  <Lock size={12} /> Bloccata da email
                                </span>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteActivity(a.id)}
                                  className="text-gray-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {a.descrizione && (
                            <p className="text-sm text-gray-500 mb-2">{a.descrizione}</p>
                          )}

                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${a.avanzamento}%` }} />
                              </div>
                            </div>
                            {isAdmin ? (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={a.avanzamento}
                                  onChange={(e) => handleUpdateActivity(a.id, { avanzamento: parseInt(e.target.value) || 0 })}
                                  className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-center"
                                />
                                <span className="text-xs text-gray-400">%</span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">{a.avanzamento}%</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                            {a.assegnato_nome && (
                              <span>Assegnato a: <span className="text-gray-600">{a.assegnato_nome}</span></span>
                            )}
                            {a.created_at && (
                              <span>Creata: {new Date(a.created_at).toLocaleDateString('it-IT')}</span>
                            )}
                            {a.data_inizio && (
                              <span>Inizio: {new Date(a.data_inizio).toLocaleDateString('it-IT')}</span>
                            )}
                            {a.data_scadenza && (
                              <span>Fine prevista: {new Date(a.data_scadenza).toLocaleDateString('it-IT')}</span>
                            )}
                            <span className={isCompleted ? 'text-green-600 font-medium' : 'text-gray-300'}>
                              Completata: {isCompleted && a.data_completamento
                                ? new Date(a.data_completamento).toLocaleDateString('it-IT')
                                : '—'}
                            </span>
                          </div>
                          {/* Admin inline edits for ordine and dipende_da */}
                          {isAdmin && (
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              {!a.dipende_da && (
                                <label className="flex items-center gap-1 text-xs text-gray-400">
                                  Ordine:
                                  <input
                                    type="number"
                                    min="0"
                                    value={a.ordine ?? 0}
                                    onChange={(e) => handleUpdateActivity(a.id, { ordine: parseInt(e.target.value) || 0 })}
                                    className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-center"
                                  />
                                </label>
                              )}
                              <label className="flex items-center gap-1 text-xs text-gray-400">
                                Dipendenza:
                                <select
                                  value={a.dipende_da || ''}
                                  onChange={(e) => handleUpdateActivity(a.id, { dipende_da: e.target.value ? Number(e.target.value) : null })}
                                  className="rounded border border-gray-200 px-1.5 py-0.5 text-xs max-w-[180px]"
                                >
                                  <option value="">Nessuna</option>
                                  {project.attivita.filter(x => x.id !== a.id).map(x => (
                                    <option key={x.id} value={x.id}>#{x.ordine || x.id} - {x.nome}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}

                          <div className="mt-2">
                            <button
                              onClick={() => toggleNote(a.id)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span className="flex items-center gap-1">Note{noteCount > 0 && <><BellRing size={12} className="text-amber-500" /> <span>({noteCount})</span></>}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-3">
                                {noteCount === 0 ? (
                                  <p className="text-xs text-gray-400 italic">Nessuna nota</p>
                                ) : (
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {noteList.map(n => (
                                      <div key={n.id} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs font-medium text-gray-700">{n.utente_nome}</span>
                                          <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('it-IT')}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.testo}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Aggiungi una nota..."
                                    value={newNoteText[a.id] || ''}
                                    onChange={(e) => setNewNoteText(prev => ({ ...prev, [a.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNote(a.id) } }}
                                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    onClick={() => handleAddNote(a.id)}
                                    disabled={!newNoteText[a.id]?.trim()}
                                    className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Aggiungi
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </>
            )}

            {/* ===== TAB EMAIL PROGETTO ===== */}
            {mainTab === 'email' && (() => {
              const ricevute = emailsProgetto.filter(e => e.direzione !== 'inviata')
              const inviate = emailsProgetto.filter(e => e.direzione === 'inviata')
              const dirEmails = emailDir === 'inviate' ? inviate : ricevute
              return (
              <>
                {/* Direction tabs */}
                <div className="flex border-b border-gray-100">
                  {[
                    { key: 'ricevute', label: 'In arrivo', count: ricevute.length },
                    { key: 'inviate', label: 'Inviate', count: inviate.length },
                  ].map(d => (
                    <button key={d.key} onClick={() => { setEmailDir(d.key); setEmailFilter('tutte') }}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium text-center cursor-pointer transition-colors ${
                        emailDir === d.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}>
                      {d.label} <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{d.count}</span>
                    </button>
                  ))}
                </div>
                {/* Sub-filters */}
                <div className="flex gap-1 px-4 pt-3 pb-2">
                  {[
                    { key: 'tutte', label: 'Tutte', count: dirEmails.length, active: 'bg-blue-100 text-blue-800', counter: 'bg-blue-200' },
                    { key: 'rilevanti', label: 'Rilevanti', count: dirEmails.filter(e => e.rilevanza === 'rilevante').length, active: 'bg-purple-100 text-purple-800', counter: 'bg-purple-200' },
                    { key: 'di_contesto', label: 'Di contesto', count: dirEmails.filter(e => e.rilevanza === 'di_contesto').length, active: 'bg-slate-200 text-slate-800', counter: 'bg-slate-300' },
                    { key: 'bloccanti', label: 'Bloccanti', count: dirEmails.filter(e => e.is_bloccante).length, active: 'bg-orange-100 text-orange-800', counter: 'bg-orange-200' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setEmailFilter(f.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        emailFilter === f.key ? f.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {f.label} <span className={`ml-1 px-1 py-0.5 rounded text-xs ${emailFilter === f.key ? f.counter : 'bg-gray-200'}`}>{f.count}</span>
                    </button>
                  ))}
                </div>
                {(() => {
                  const filtered = emailFilter === 'rilevanti' ? dirEmails.filter(e => e.rilevanza === 'rilevante')
                    : emailFilter === 'di_contesto' ? dirEmails.filter(e => e.rilevanza === 'di_contesto')
                    : emailFilter === 'bloccanti' ? dirEmails.filter(e => e.is_bloccante)
                    : dirEmails
                  if (filtered.length === 0) return <p className="p-4 text-sm text-gray-400">Nessuna email in questa categoria</p>
                  return (
                    <div className="divide-y divide-gray-100">
                      {filtered.map(e => (
                        <div key={e.id} className={`p-4 ${e.is_bloccante ? 'bg-orange-50/50 border-l-4 border-l-orange-400' : ''}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleEmail(e.id)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                {expandedEmails[e.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              <p className="text-sm font-medium">
                                {e.oggetto}
                                {e.is_bloccante && <span className="ml-2 text-xs text-orange-600 font-medium">BLOCCANTE</span>}
                                {e.rilevanza === 'rilevante' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-purple-600 font-medium"><Star size={11} /> RILEVANTE</span>}
                                {e.rilevanza === 'di_contesto' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-500 font-medium"><Info size={11} /> DI CONTESTO</span>}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400">{new Date(e.data_ricezione).toLocaleString('it-IT')}</p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6">{e.mittente} → {e.destinatario}</p>
                          {e.thread_count > 1 && (
                            <Link
                              to={`/admin/emails?cliente_id=${project.cliente_id || ''}&progetto_id=${project.id}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-6 mt-1"
                            >
                              <ExternalLink size={12} /> Vai al thread ({e.thread_count} messaggi)
                            </Link>
                          )}
                          {expandedEmails[e.id] && e.corpo && (
                            <div className="mt-2 ml-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{e.corpo}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
              )
            })()}

            {/* ===== TAB EMAIL ATTIVITÀ ===== */}
            {mainTab === 'email_attivita' && (() => {
              const ricevuteAtt = emailsAttivita.filter(e => e.direzione !== 'inviata')
              const inviateAtt = emailsAttivita.filter(e => e.direzione === 'inviata')
              const dirEmailsAtt = emailDir === 'inviate' ? inviateAtt : ricevuteAtt
              return (
              <>
                {/* Direction tabs */}
                <div className="flex border-b border-gray-100">
                  {[
                    { key: 'ricevute', label: 'In arrivo', count: ricevuteAtt.length },
                    { key: 'inviate', label: 'Inviate', count: inviateAtt.length },
                  ].map(d => (
                    <button key={d.key} onClick={() => { setEmailDir(d.key); setEmailFilter('tutte') }}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium text-center cursor-pointer transition-colors ${
                        emailDir === d.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}>
                      {d.label} <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{d.count}</span>
                    </button>
                  ))}
                </div>
                {/* Sub-filters */}
                <div className="flex gap-1 px-4 pt-3 pb-2">
                  {[
                    { key: 'tutte', label: 'Tutte', count: dirEmailsAtt.length, active: 'bg-blue-100 text-blue-800', counter: 'bg-blue-200' },
                    { key: 'rilevanti', label: 'Rilevanti', count: dirEmailsAtt.filter(e => e.rilevanza === 'rilevante').length, active: 'bg-purple-100 text-purple-800', counter: 'bg-purple-200' },
                    { key: 'di_contesto', label: 'Di contesto', count: dirEmailsAtt.filter(e => e.rilevanza === 'di_contesto').length, active: 'bg-slate-200 text-slate-800', counter: 'bg-slate-300' },
                    { key: 'bloccanti', label: 'Bloccanti', count: dirEmailsAtt.filter(e => e.is_bloccante).length, active: 'bg-orange-100 text-orange-800', counter: 'bg-orange-200' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setEmailFilter(f.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        emailFilter === f.key ? f.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {f.label} <span className={`ml-1 px-1 py-0.5 rounded text-xs ${emailFilter === f.key ? f.counter : 'bg-gray-200'}`}>{f.count}</span>
                    </button>
                  ))}
                </div>
                {(() => {
                  const filtered = emailFilter === 'rilevanti' ? dirEmailsAtt.filter(e => e.rilevanza === 'rilevante')
                    : emailFilter === 'di_contesto' ? dirEmailsAtt.filter(e => e.rilevanza === 'di_contesto')
                    : emailFilter === 'bloccanti' ? dirEmailsAtt.filter(e => e.is_bloccante)
                    : dirEmailsAtt
                  if (filtered.length === 0) return <p className="p-4 text-sm text-gray-400">Nessuna email in questa categoria</p>
                  return (
                    <div className="divide-y divide-gray-100">
                      {filtered.map(e => (
                        <div key={e.id} className={`p-4 ${e.is_bloccante ? 'bg-orange-50/50 border-l-4 border-l-orange-400' : ''}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleEmail(e.id)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                {expandedEmails[e.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              <p className="text-sm font-medium">
                                {e.oggetto}
                                {e.is_bloccante && <span className="ml-2 text-xs text-orange-600 font-medium">BLOCCANTE</span>}
                                {e.rilevanza === 'rilevante' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-purple-600 font-medium"><Star size={11} /> RILEVANTE</span>}
                                {e.rilevanza === 'di_contesto' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-500 font-medium"><Info size={11} /> DI CONTESTO</span>}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400">{new Date(e.data_ricezione).toLocaleString('it-IT')}</p>
                          </div>
                          <p className="text-xs text-gray-500 ml-6">{e.mittente} → {e.destinatario}</p>
                          {e.attivita_nome && (
                            <p className="text-xs text-orange-600 font-medium ml-6 mt-1">Attività: {e.attivita_nome}</p>
                          )}
                          {e.thread_count > 1 && (
                            <Link
                              to={`/admin/emails?cliente_id=${project.cliente_id || ''}&progetto_id=${project.id}&attivita_id=${e.attivita_id || ''}`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-6 mt-1"
                            >
                              <ExternalLink size={12} /> Vai al thread ({e.thread_count} messaggi)
                            </Link>
                          )}
                          {expandedEmails[e.id] && e.corpo && (
                            <div className="mt-2 ml-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{e.corpo}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
              )
            })()}
          </div>

          {/* Internal Notes */}
          {project.note && project.note.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <StickyNote size={18} className="text-yellow-500" />
                <h2 className="text-lg font-semibold">Note Interne</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {project.note.map(n => (
                  <div key={n.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700">{n.utente_nome}</p>
                      <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('it-IT')}</p>
                    </div>
                    <p className="text-sm text-gray-600">{n.testo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold mb-3">Gestione</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Stato progetto</label>
                  <select
                    value={project.stato}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className={selectCls}
                  >
                    <option value="attivo">Attivo</option>
                    <option value="in_pausa">In pausa</option>
                    <option value="completato">Completato</option>
                    <option value="annullato">Annullato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Blocco</label>
                  <select
                    value={project.blocco}
                    onChange={(e) => handleBloccoChange(e.target.value)}
                    className={selectCls}
                  >
                    <option value="nessuno">Nessun blocco</option>
                    <option value="lato_admin">Fermo lato admin</option>
                    <option value="lato_cliente">Fermo lato cliente</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Visibility / Tecnici */}
          {isAdmin && tecnici.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-blue-500" />
                <h3 className="text-sm font-semibold">Visibilità</h3>
              </div>
              <div className="space-y-2">
                {tecnici.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(project.tecnici || []).includes(u.id)}
                      onChange={() => handleTecnicoToggle(u.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{u.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Chat Progetto */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-500" />
              <h3 className="text-sm font-semibold">Chat Progetto</h3>
              {project.chat && project.chat.length > 0 && (
                <span className="text-xs text-gray-400">({project.chat.length})</span>
              )}
            </div>

            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
              {(!project.chat || project.chat.length === 0) ? (
                <p className="text-xs text-gray-400 italic text-center py-3">Nessun messaggio</p>
              ) : (
                project.chat.map(m => {
                  const isMe = m.utente_id === currentUser.id
                  const isMsgAdmin = m.utente_ruolo === 'admin'
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-lg px-3 py-1.5 ${
                        isMsgAdmin
                          ? 'bg-blue-50 border border-blue-100'
                          : 'bg-gray-100 border border-gray-200'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs font-semibold ${isMsgAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                            {m.utente_nome}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(m.created_at).toLocaleString('it-IT')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{m.testo}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="p-2 border-t border-gray-100 flex gap-1.5">
              <input
                type="text"
                placeholder="Scrivi..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!chatText.trim() || sendingChat}
                className="bg-blue-600 text-white rounded-lg px-2.5 py-1.5 text-xs hover:bg-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
