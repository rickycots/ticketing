import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, StickyNote, Building2, Phone, User, Mail, ChevronDown, ChevronRight, Lock, ArrowRightLeft } from 'lucide-react'
import { activities, users } from '../../api/client'

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
  const [activity, setActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userList, setUserList] = useState([])
  const [noteText, setNoteText] = useState('')
  const [sendingNote, setSendingNote] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)
  const [emailTab, setEmailTab] = useState('tutte')
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  async function loadActivity() {
    try {
      const data = await activities.get(projectId, activityId)
      setActivity(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadActivity()
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
      await activities.addNote(projectId, activityId, noteText.trim())
      await loadActivity()
      setNoteText('')
    } catch (err) { console.error(err) }
    finally { setSendingNote(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (!activity) return <div className="text-center text-gray-400 py-12">Attività non trovata</div>

  const isCompleted = activity.stato === 'completata'
  const noteList = activity.note_attivita || []
  const prog = activity.progetto || {}

  return (
    <div>
      <Link to={`/admin/projects/${projectId}/gantt`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
        <ArrowLeft size={16} /> Torna alla timeline
      </Link>

      {/* Page title */}
      <h1 className="text-2xl font-bold text-blue-600 mb-1">
        {activity.nome}
      </h1>
      <p className="text-sm text-gray-400 mb-4">
        Progetto: <Link to={`/admin/projects/${projectId}`} className="text-blue-500 hover:underline">{prog.nome || `#${projectId}`}</Link>
        {activity.created_at && <> &middot; Creata il {new Date(activity.created_at).toLocaleDateString('it-IT')}</>}
      </p>

      {/* Client Banner */}
      {prog.cliente_nome && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Building2 size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-teal-900">{prog.cliente_nome}</h2>
              <div className="flex items-center gap-4 text-sm text-teal-700 mt-0.5">
                {prog.cliente_email && (
                  <span className="flex items-center gap-1"><Mail size={13} /> {prog.cliente_email}</span>
                )}
                {prog.cliente_telefono && (
                  <span className="flex items-center gap-1"><Phone size={13} /> {prog.cliente_telefono}</span>
                )}
                {prog.cliente_referente && (
                  <span className="flex items-center gap-1"><User size={13} /> {prog.cliente_referente}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Activity Header Card */}
          <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${statoBorder[activity.stato] || ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{activity.nome}</h2>
                {activity.descrizione && (
                  <p className="text-gray-600 mt-2 whitespace-pre-wrap">{activity.descrizione}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <span className={`${badgeCls} ${prioritaColors[activity.priorita]}`}>{activity.priorita}</span>
                <span className={`${badgeCls} ${actStatoColors[activity.stato]}`}>{actStatoLabels[activity.stato]}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Avanzamento</span>
                <span className="text-sm font-bold text-blue-600">{activity.avanzamento}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${activity.avanzamento}%` }} />
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100">
              {activity.assegnato_nome && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Assegnato a</p>
                  <p className="text-sm font-medium text-gray-700">{activity.assegnato_nome}</p>
                </div>
              )}
              {activity.data_inizio && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Data Inizio</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(activity.data_inizio).toLocaleDateString('it-IT')}</p>
                </div>
              )}
              {activity.data_scadenza && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Fine Prevista</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(activity.data_scadenza).toLocaleDateString('it-IT')}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Completata</p>
                <p className={`text-sm font-medium ${isCompleted ? 'text-green-600' : 'text-gray-300'}`}>
                  {isCompleted && activity.data_completamento
                    ? new Date(activity.data_completamento).toLocaleDateString('it-IT')
                    : '—'}
                </p>
              </div>
            </div>

            {/* Blocking email warning */}
            {activity.email_bloccante && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-sm text-orange-700">
                <Lock size={16} /> Bloccata da email: <b>{activity.email_bloccante.oggetto}</b>
              </div>
            )}
          </div>

          {/* Dependencies info */}
          {(activity.dipendenza || (activity.dipendenti && activity.dipendenti.length > 0)) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-orange-500" />
                <h2 className="font-semibold">Dipendenze</h2>
              </div>
              <div className="p-4 space-y-3">
                {activity.dipendenza && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Dipende da</p>
                    <Link to={`/admin/projects/${projectId}/activities/${activity.dipendenza.id}`}
                      className="inline-flex items-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg px-3 py-1.5 hover:bg-orange-100">
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
                          className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100">
                          {d.nome}
                          <span className={`${badgeCls} ${actStatoColors[d.stato]} text-[10px]`}>{actStatoLabels[d.stato]}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Associated Emails with tabs */}
          {activity.emails && activity.emails.length > 0 && (() => {
            const allEmails = activity.emails
            const bloccanti = allEmails.filter(e => e.is_bloccante)
            const rilevanti = allEmails.filter(e => e.rilevanza === 'rilevante')
            const contesto = allEmails.filter(e => e.rilevanza === 'di_contesto')
            const tabs = [
              { key: 'tutte', label: 'Tutte', count: allEmails.length },
              { key: 'bloccanti', label: 'Bloccanti', count: bloccanti.length },
              { key: 'rilevanti', label: 'Rilevanti', count: rilevanti.length },
              { key: 'contesto', label: 'Di contesto', count: contesto.length },
            ]
            const filtered = emailTab === 'bloccanti' ? bloccanti
              : emailTab === 'rilevanti' ? rilevanti
              : emailTab === 'contesto' ? contesto
              : allEmails
            return (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <Mail size={18} className="text-blue-500" />
                  <h2 className="font-semibold">Email Associate</h2>
                  <span className="text-xs text-gray-400">({allEmails.length})</span>
                </div>
                <div className="flex border-b border-gray-100">
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => setEmailTab(t.key)}
                      className={`flex-1 px-3 py-2 text-xs font-medium text-center cursor-pointer transition-colors ${
                        emailTab === t.key
                          ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}>
                      {t.label} {t.count > 0 && <span className="ml-1 text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5">{t.count}</span>}
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
                            {e.is_bloccante && <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">Bloccante</span>}
                            {e.rilevanza === 'rilevante' && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">Rilevante</span>}
                            {e.rilevanza === 'di_contesto' && <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">Contesto</span>}
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
              </div>
            )
          })()}

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setNotesOpen(!notesOpen)}
              className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <StickyNote size={18} className="text-yellow-500" />
                <h2 className="font-semibold">Note Attività</h2>
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
                  <div className="flex justify-end">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold mb-3">Azioni</h3>
            <div className="space-y-3">
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
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assegna a</label>
                  <select value={activity.assegnato_a || ''} onChange={(e) => handleFieldChange('assegnato_a', e.target.value ? Number(e.target.value) : null)} className={selectCls}>
                    <option value="">Non assegnato</option>
                    {userList.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.ruolo})</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
