import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, StickyNote, Building2, Phone, User, Mail, ChevronDown, ChevronRight, Lock, ArrowRightLeft, Calendar, Plus, Trash2, X, Pencil, Send, Paperclip, Upload, Download } from 'lucide-react'
import { activities, users, clients as clientsApi } from '../../api/client'
import HelpTip from '../../components/HelpTip'

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
const prioritaColors = {
  alta: 'bg-red-100 text-red-800',
  media: 'bg-yellow-100 text-yellow-800',
  bassa: 'bg-gray-100 text-gray-600',
}
const statoBorder = {
  da_fare: 'border-l-4 border-l-yellow-400',
  in_corso: 'border-l-4 border-l-blue-500',
  completata: 'border-l-4 border-l-green-400',
  bloccata: 'border-l-4 border-l-red-400',
}

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
const badgeCls = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"

export default function ActivityDetail() {
  const { id: projectId, activityId } = useParams()
  const navigate = useNavigate()
  const [activity, setActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [userList, setUserList] = useState([])
  const [showTecniciDropdown, setShowTecniciDropdown] = useState(false)
  const [showDipendenze, setShowDipendenze] = useState(false)
  const [showAzioni, setShowAzioni] = useState(true)
  const [scheduled, setScheduled] = useState([])
  const [showScheduledForm, setShowScheduledForm] = useState(false)
  const [schedForm, setSchedForm] = useState({ nota: '', data_pianificata: '', referenti_ids: '' })
  const [projectReferenti, setProjectReferenti] = useState([])
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [noteText, setNoteText] = useState('')
  const [sendingNote, setSendingNote] = useState(false)
  const [noteToKB, setNoteToKB] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [emailTab, setEmailTab] = useState('tutte')
  const [emailDir, setEmailDir] = useState('ricevute')
  const [showEmails, setShowEmails] = useState(false)
  const [showAllegati, setShowAllegati] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function openEditModal() {
    setEditFormData({
      nome: activity.nome || '',
      descrizione: activity.descrizione || '',
      priorita: activity.priorita || 'media',
      data_inizio: activity.data_inizio || '',
      data_scadenza: activity.data_scadenza || '',
    })
    setShowEditModal(true)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    try {
      const updated = await activities.update(projectId, activityId, editFormData)
      setActivity(prev => ({ ...prev, ...updated }))
      setShowEditModal(false)
    } catch (err) { alert(err.message) }
  }

  async function handleCreateScheduled(e) {
    e.preventDefault()
    if (!schedForm.nota.trim() || !schedForm.data_pianificata) return
    try {
      await activities.createScheduled(projectId, activityId, schedForm)
      setSchedForm({ nota: '', data_pianificata: '', referenti_ids: '' })
      setShowScheduledForm(false)
      loadScheduled()
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteScheduled(schedId) {
    if (!confirm('Eliminare questa attività programmata?')) return
    try {
      await activities.deleteScheduled(projectId, activityId, schedId)
      loadScheduled()
    } catch (err) { alert(err.message) }
  }

  function loadScheduled() {
    activities.getScheduled(projectId, activityId).then(setScheduled).catch(() => {})
  }

  async function loadActivity() {
    try {
      const data = await activities.get(projectId, activityId)
      setActivity(data)
      if (data.emails?.some(e => e.is_bloccante)) setShowEmails(true)
      if (data.progetto?.cliente_id) {
        clientsApi.getReferenti(data.progetto.cliente_id).then(r => setProjectReferenti(Array.isArray(r) ? r : [])).catch(() => {})
      }
    } catch (err) {
      if (err.message && (err.message.includes('abilitato') || err.message.includes('403') || err.message.includes('consentito'))) {
        setAccessDenied(true)
      }
      console.error(err)
    }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadActivity()
    loadScheduled()
    if (isAdmin) users.list().then(setUserList).catch(() => {})
  }, [projectId, activityId])

  async function handleFieldChange(field, value) {
    try {
      const updated = await activities.update(projectId, activityId, { [field]: value })
      setActivity(prev => ({ ...prev, ...updated }))
    } catch (err) { console.error(err); alert(err.message) }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setSendingNote(true)
    try {
      await activities.addNote(projectId, activityId, noteText.trim(), noteToKB)
      await loadActivity()
      setNoteText('')
      setNoteToKB(false)
    } catch (err) { console.error(err) }
    finally { setSendingNote(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (accessDenied) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Lock size={48} className="text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Utente non abilitato</p>
      <p className="text-sm text-gray-400">Non hai i permessi per accedere a questa attività</p>
      <Link to={`/admin/projects/${projectId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
        <ArrowLeft size={14} /> Torna al progetto
      </Link>
    </div>
  )
  if (!activity) return <div className="text-center text-gray-400 py-12">Attività non trovata</div>

  const isCompleted = activity.stato === 'completata'
  const noteList = activity.note_attivita || []
  const allegatiList = activity.allegati || []
  const prog = activity.progetto || {}

  async function handleUploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    setUploadingFiles(true)
    try {
      await activities.uploadAllegati(projectId, activityId, Array.from(fileList))
      loadActivity()
    } catch (err) { alert(err.message) }
    finally { setUploadingFiles(false) }
  }

  async function handleDeleteAllegato(allegatoId) {
    if (!confirm('Eliminare questo allegato?')) return
    try {
      await activities.deleteAllegato(projectId, activityId, allegatoId)
      loadActivity()
    } catch (err) { alert(err.message) }
  }

  return (
    <div>
      <Link to={`/admin/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
        <ArrowLeft size={16} /> Torna al progetto
      </Link>

      {/* Page title */}
      <h1 className="text-2xl font-bold mb-1">Dettaglio Attività</h1>
      <p className="text-sm text-gray-400 mb-4">
        Progetto Padre: <Link to={`/admin/projects/${projectId}/gantt`} className="text-blue-500 hover:underline">{prog.nome || `#${projectId}`}</Link>
      </p>

      {/* Client Banner */}
      {prog.cliente_nome && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-teal-600" />
          </div>
          <span className="text-sm font-bold text-teal-900">Cliente: {prog.cliente_nome}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Activity Header Card */}
          <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${statoBorder[activity.stato] || ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{activity.nome}</h1>
                  <HelpTip text="Dettaglio attività con stato avanzamento, email associate, note e attività programmate. Lo slider percentuale indica l'avanzamento. Le email bloccanti mettono l'attività in stato 'bloccata'." />
                  {isAdmin && (
                    <>
                    <button onClick={openEditModal} className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors" title="Modifica attività">
                      <Pencil size={15} />
                    </button>
                    <button onClick={async () => {
                      if (!confirm('Eliminare questa attività? Questa azione è irreversibile.')) return
                      try {
                        await activities.delete(projectId, activityId)
                        navigate(`/admin/projects/${projectId}`)
                      } catch (err) { alert(err.message) }
                    }} className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors" title="Elimina attività">
                      <Trash2 size={15} />
                    </button>
                    </>
                  )}
                </div>
                {activity.descrizione && (
                  <p className="text-sm text-gray-500 mt-1"><span className="italic text-gray-400">Descrizione:</span> {activity.descrizione}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <span className={`${badgeCls} ${prioritaColors[activity.priorita]}`}>{activity.priorita}</span>
                <span className={`${badgeCls} ${actStatoColors[activity.stato]}`}>{actStatoLabels[activity.stato]}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${activity.avanzamento}%` }} />
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700">{activity.avanzamento}%</span>
              {(activity.tecnici_nomi?.length > 0 || activity.assegnato_nome) && (
                <span className="text-sm text-gray-400">
                  {activity.tecnici_nomi?.length > 0
                    ? activity.tecnici_nomi.map(t => t.nome).join(', ')
                    : activity.assegnato_nome}
                </span>
              )}
            </div>

            {/* Dates */}
            <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
              {activity.data_inizio && <span>Inizio: <b className="text-gray-700">{new Date(activity.data_inizio).toLocaleDateString('it-IT')}</b></span>}
              {activity.data_scadenza && <span>Scadenza: <b className="text-gray-700">{new Date(activity.data_scadenza).toLocaleDateString('it-IT')}</b></span>}
              {isCompleted && activity.data_completamento && <span>Completata: <b className="text-green-600">{new Date(activity.data_completamento).toLocaleDateString('it-IT')}</b></span>}
            </div>

            {/* Links row: Allegati */}
            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={() => setShowAllegati(prev => !prev)}
                className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${showAllegati ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Paperclip size={14} className={showAllegati ? 'text-blue-500' : ''} />
                <span className="font-medium">Allegati Attività</span>
                {allegatiList.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{allegatiList.length}</span>
                )}
              </button>
            </div>

            {showAllegati && (
              <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <div className="p-3 border-b border-gray-200">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
                    <Upload size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {uploadingFiles ? 'Caricamento...' : 'Carica allegati (clicca o trascina)'}
                    </span>
                    <input type="file" multiple className="hidden" disabled={uploadingFiles} onChange={e => handleUploadFiles(e.target.files)} />
                  </label>
                </div>
                {allegatiList.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {allegatiList.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip size={14} className="text-gray-400 shrink-0" />
                          <span className="truncate text-gray-700">{a.nome_originale}</span>
                          <span className="text-xs text-gray-400 shrink-0">({(a.dimensione / 1024).toFixed(0)} KB)</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={`/api/projects/${projectId}/activities/${activityId}/allegati/${a.id}`} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded text-gray-400 hover:text-blue-600 cursor-pointer"><Download size={14} /></a>
                          <button onClick={() => handleDeleteAllegato(a.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-3 text-sm text-gray-400 text-center">Nessun allegato</p>
                )}
              </div>
            )}

            {/* Blocking email warning */}
            {activity.email_bloccante && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-sm text-orange-700">
                <Lock size={16} /> Bloccata da email: <b>{activity.email_bloccante.oggetto}</b>
              </div>
            )}
          </div>

          {/* Associated Emails with tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setShowEmails(!showEmails)} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -ml-2">
                <Mail size={18} className="text-blue-500" />
                <h2 className="text-lg font-semibold">Email Associate</h2>
                <span className="text-xs text-gray-400">({(activity.emails || []).length})</span>
                {showEmails ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              </button>
              <Link to={`/admin/send-mail?progetto_id=${projectId}&attivita_id=${activityId}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                <Send size={14} /> Invia Mail
              </Link>
            </div>
            {showEmails && (() => {
              const allEmails = activity.emails || []
              if (allEmails.length === 0) return <div className="p-6 text-center text-sm text-gray-400 border-t border-gray-100">Nessuna email associata</div>
              const ricevute = allEmails.filter(e => e.direzione !== 'inviata')
              const inviate = allEmails.filter(e => e.direzione === 'inviata')
              const dirEmails = emailDir === 'inviate' ? inviate : ricevute
              const bloccanti = dirEmails.filter(e => e.is_bloccante)
              const rilevanti = dirEmails.filter(e => e.rilevanza === 'rilevante')
              const contesto = dirEmails.filter(e => e.rilevanza === 'di_contesto')
              const tabs = [
                { key: 'tutte', label: 'Tutte', count: dirEmails.length },
                { key: 'bloccanti', label: 'Bloccanti', count: bloccanti.length },
                { key: 'rilevanti', label: 'Rilevanti', count: rilevanti.length },
                { key: 'contesto', label: 'Di contesto', count: contesto.length },
              ]
              const filtered = emailTab === 'bloccanti' ? bloccanti
                : emailTab === 'rilevanti' ? rilevanti
                : emailTab === 'contesto' ? contesto
                : dirEmails
              return (
                <>
                  <div className="flex border-t border-gray-100">
                    {[
                      { key: 'ricevute', label: 'In arrivo', count: ricevute.length },
                      { key: 'inviate', label: 'Inviate', count: inviate.length },
                    ].map(d => (
                      <button key={d.key} onClick={() => { setEmailDir(d.key); setEmailTab('tutte') }}
                        className={`flex-1 px-3 py-2.5 text-sm font-medium text-center cursor-pointer transition-colors ${
                          emailDir === d.key
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}>
                        {d.label} <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{d.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex border-b border-gray-100">
                    {tabs.map(t => (
                      <button key={t.key} onClick={() => setEmailTab(t.key)}
                        className={`flex-1 px-3 py-2 text-xs font-medium text-center cursor-pointer transition-colors ${
                          emailTab === t.key
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}>
                        {t.label} {t.count > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{t.count}</span>}
                      </button>
                    ))}
                  </div>
                  {filtered.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {filtered.map(e => (
                        <div key={e.id} className={`p-4 ${e.is_bloccante ? 'bg-red-50/50' : e.rilevanza === 'rilevante' ? 'bg-amber-50/50' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{e.mittente}</p>
                              {e.is_bloccante && <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">Bloccante</span>}
                              {e.rilevanza === 'rilevante' && <span className="text-xs font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">Rilevante</span>}
                              {e.rilevanza === 'di_contesto' && <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">Contesto</span>}
                            </div>
                            <p className="text-xs font-semibold text-gray-400">{new Date(e.data_ricezione).toLocaleString('it-IT')}</p>
                          </div>
                          <p className="text-xs font-medium text-gray-500 mb-1">{e.oggetto}</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{e.corpo}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-400">Nessuna email in questa categoria</div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setNotesOpen(!notesOpen)}
              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <StickyNote size={18} className="text-yellow-500" />
                <h2 className="text-lg font-semibold">Note Attività</h2>
                <span className="text-xs text-gray-400">({noteList.length})</span>
              </div>
              {notesOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            {notesOpen && (
              <div className="border-t border-gray-100">
                {noteList.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {noteList.map(n => (
                      <div key={n.id} className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-700">{n.utente_nome}</p>
                          <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('it-IT')}</p>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.testo}</p>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddNote} className="p-4 border-t border-gray-100 space-y-2">
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Aggiungi una nota..." rows={2}
                    className={`${selectCls} resize-none`} />
                  <div className="flex items-center justify-between">
                    {(isAdmin || currentUser.abilitato_ai) ? (
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                        <input type="checkbox" checked={noteToKB} onChange={(e) => setNoteToKB(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        Salva in Knowledge Base (disponibile per AI cliente)
                      </label>
                    ) : <span />}
                    <button type="submit" disabled={sendingNote || !noteText.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                      <StickyNote size={14} /> {sendingNote ? 'Salvataggio...' : 'Aggiungi Nota'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setShowAzioni(!showAzioni)} className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <h3 className="text-sm font-semibold">Azioni</h3>
              {showAzioni ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            </button>
            {showAzioni && <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stato</label>
                {activity.email_bloccante ? (
                  <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <Lock size={12} className="inline mr-1" /> Bloccata da email
                  </p>
                ) : (
                  <select value={activity.stato} onChange={(e) => handleFieldChange('stato', e.target.value)} className={selectCls}>
                    {Object.entries(actStatoLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priorità</label>
                <select value={activity.priorita} onChange={(e) => handleFieldChange('priorita', e.target.value)} className={selectCls}
                  disabled={!isAdmin}>
                  {['alta', 'media', 'bassa'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Avanzamento</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="100" step="5" value={activity.avanzamento}
                    onChange={(e) => handleFieldChange('avanzamento', parseInt(e.target.value))}
                    className="flex-1 accent-blue-500" disabled={!isAdmin} />
                  <span className="text-sm font-bold text-blue-600 w-10 text-right">{activity.avanzamento}%</span>
                </div>
              </div>
              {isAdmin && (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assegna a</label>
                  {(() => {
                    const selectedIds = (activity.tecnici_ids || '').split(',').filter(Boolean).map(Number)
                    const selectedNames = userList.filter(u => selectedIds.includes(u.id)).map(u => u.nome)
                    const label = selectedNames.length === 0 ? 'Non assegnato' : selectedNames.length === 1 ? selectedNames[0] : `Abilitati ${selectedNames.length}`
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowTecniciDropdown(prev => !prev)}
                          className={`${selectCls} text-left flex items-center justify-between cursor-pointer`}
                        >
                          <span className={selectedNames.length === 0 ? 'text-gray-400' : ''}>{label}</span>
                          <ChevronDown size={14} className="text-gray-400" />
                        </button>
                        {showTecniciDropdown && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                            {userList.map(u => {
                              const checked = selectedIds.includes(u.id)
                              return (
                                <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={async () => {
                                      const updated = checked ? selectedIds.filter(id => id !== u.id) : [...selectedIds, u.id]
                                      try {
                                        const result = await activities.update(projectId, activityId, {
                                          tecnici_ids: updated.join(',') || null,
                                          assegnato_a: updated.length > 0 ? updated[0] : null
                                        })
                                        setActivity(prev => ({ ...prev, ...result }))
                                      } catch (err) { alert(err.message) }
                                    }}
                                    className="rounded border-gray-300 text-blue-600"
                                  />
                                  <span>{u.nome}</span>
                                  <span className="text-xs text-gray-400">({u.ruolo})</span>
                                </label>
                              )
                            })}
                            <div className="border-t border-gray-100 px-3 py-1.5 flex justify-end">
                              <button type="button" onClick={() => setShowTecniciDropdown(false)} className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium">Chiudi</button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>}
          </div>

          {/* Dependencies */}
          {(activity.dipendenza || (activity.dipendenti && activity.dipendenti.length > 0)) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <button
                onClick={() => setShowDipendenze(prev => !prev)}
                className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-orange-500" />
                  <h3 className="text-sm font-semibold">Dipendenze</h3>
                </div>
                {showDipendenze ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              </button>
              {showDipendenze && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  {activity.dipendenza && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Dipende da</p>
                      <Link to={`/admin/projects/${projectId}/activities/${activity.dipendenza.id}`}
                        className="inline-flex items-center gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg px-2.5 py-1.5 hover:bg-orange-100">
                        {activity.dipendenza.nome}
                        <span className={`${badgeCls} ${actStatoColors[activity.dipendenza.stato]} text-[10px]`}>{actStatoLabels[activity.dipendenza.stato]}</span>
                      </Link>
                    </div>
                  )}
                  {activity.dipendenti && activity.dipendenti.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Attività dipendenti</p>
                      <div className="space-y-1">
                        {activity.dipendenti.map(d => (
                          <Link key={d.id} to={`/admin/projects/${projectId}/activities/${d.id}`}
                            className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1.5 hover:bg-blue-100">
                            {d.nome}
                            <span className={`${badgeCls} ${actStatoColors[d.stato]} text-[10px]`}>{actStatoLabels[d.stato]}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attività Programmate + Calendar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setShowCalendar(prev => !prev)} className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-red-500" />
                <h3 className="text-sm font-semibold">Attività Programmate</h3>
                {scheduled.length > 0 && <span className="bg-red-100 text-red-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{scheduled.length}</span>}
              </div>
              {showCalendar ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            </button>
            {showCalendar && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                {/* Mini Calendar */}
                {(() => {
                  const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
                  const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
                  const firstDay = new Date(calYear, calMonth, 1)
                  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
                  let startDow = firstDay.getDay() - 1
                  if (startDow < 0) startDow = 6
                  const today = new Date()
                  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                  const scheduledDates = new Set(scheduled.map(s => s.data_pianificata))
                  const cells = []
                  for (let i = 0; i < startDow; i++) cells.push(null)
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }} className="p-1 rounded hover:bg-gray-100 cursor-pointer"><ChevronRight size={14} className="rotate-180 text-gray-500" /></button>
                        <span className="text-xs font-semibold text-gray-700">{MONTHS[calMonth]} {calYear}</span>
                        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }} className="p-1 rounded hover:bg-gray-100 cursor-pointer"><ChevronRight size={14} className="text-gray-500" /></button>
                      </div>
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                        {DAYS.map((d, i) => <div key={i} className="font-semibold text-gray-400 py-1">{d}</div>)}
                        {cells.map((day, i) => {
                          if (!day) return <div key={i} />
                          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                          const hasEvent = scheduledDates.has(dateStr)
                          const isToday = dateStr === todayStr
                          const isSelected = selectedDay === dateStr
                          return (
                            <button
                              key={i}
                              onClick={() => hasEvent ? setSelectedDay(isSelected ? null : dateStr) : null}
                              className={`relative py-1 rounded text-xs transition-colors ${
                                isSelected ? 'bg-red-500 text-white' :
                                isToday ? 'bg-blue-100 text-blue-800 font-bold' :
                                hasEvent ? 'hover:bg-red-50 cursor-pointer font-medium' :
                                'text-gray-600'
                              } ${hasEvent ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              {day}
                              {hasEvent && !isSelected && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}

                {/* Selected day popup */}
                {selectedDay && (
                  <div className="mt-3 bg-red-50 rounded-lg border border-red-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-red-700">{new Date(selectedDay + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                      <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14} /></button>
                    </div>
                    <div className="space-y-2">
                      {scheduled.filter(s => s.data_pianificata === selectedDay).map(s => {
                        const refIds = (s.referenti_ids || '').split(',').filter(Boolean).map(Number)
                        const refNames = refIds.map(rid => projectReferenti.find(r => r.id === rid)).filter(Boolean).map(r => `${r.nome} ${r.cognome}`)
                        return (
                          <div key={s.id} className="bg-white rounded-lg p-2.5 border border-red-100">
                            <p className="text-sm text-gray-700">{s.nota}</p>
                            {refNames.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {refNames.map((n, i) => <span key={i} className="bg-teal-50 text-teal-700 text-[10px] rounded-full px-2 py-0.5">{n}</span>)}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-gray-400">{s.creato_da_nome}</span>
                              {isAdmin && <button onClick={() => handleDeleteScheduled(s.id)} className="text-gray-400 hover:text-red-600 cursor-pointer"><Trash2 size={12} /></button>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add button + form */}
                {isAdmin && (
                  <div className="mt-3">
                    {!showScheduledForm ? (
                      <button onClick={() => setShowScheduledForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 cursor-pointer">
                        <Plus size={14} /> Aggiungi attività programmata
                      </button>
                    ) : (
                      <form onSubmit={handleCreateScheduled} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                        <textarea value={schedForm.nota} onChange={e => setSchedForm(f => ({ ...f, nota: e.target.value }))} placeholder="Descrizione attività..." rows={2} className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none" required />
                        <input type="date" value={schedForm.data_pianificata} onChange={e => setSchedForm(f => ({ ...f, data_pianificata: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" required />
                        {projectReferenti.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 mb-1">Referenti interessati:</p>
                            <div className="flex flex-wrap gap-1">
                              {projectReferenti.map(r => {
                                const selected = (schedForm.referenti_ids || '').split(',').filter(Boolean).includes(String(r.id))
                                return (
                                  <button key={r.id} type="button" onClick={() => {
                                    const ids = (schedForm.referenti_ids || '').split(',').filter(Boolean)
                                    const updated = selected ? ids.filter(x => x !== String(r.id)) : [...ids, String(r.id)]
                                    setSchedForm(f => ({ ...f, referenti_ids: updated.join(',') }))
                                  }} className={`px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-colors ${selected ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    {r.nome} {r.cognome}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 cursor-pointer">Salva</button>
                          <button type="button" onClick={() => setShowScheduledForm(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 cursor-pointer">Annulla</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Edit Activity Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold">Modifica Attività</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input type="text" value={editFormData.nome} onChange={e => setEditFormData(f => ({ ...f, nome: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea value={editFormData.descrizione} onChange={e => setEditFormData(f => ({ ...f, descrizione: e.target.value }))} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
                <select value={editFormData.priorita} onChange={e => setEditFormData(f => ({ ...f, priorita: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="bassa">Bassa</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                  <input type="date" value={editFormData.data_inizio} onChange={e => setEditFormData(f => ({ ...f, data_inizio: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Scadenza</label>
                  <input type="date" value={editFormData.data_scadenza} onChange={e => setEditFormData(f => ({ ...f, data_scadenza: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">Salva</button>
                <button type="button" onClick={() => setShowEditModal(false)} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">Annulla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
