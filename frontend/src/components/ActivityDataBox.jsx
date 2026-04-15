import { useState } from 'react'
import { Pencil, Trash2, Paperclip, Upload, Download, ChevronRight, FileText, UserCog, X, AlertTriangle, GitBranch, Users, Plus, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import HelpTip from './HelpTip'

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
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  bassa: 'bg-gray-100 text-gray-600',
}
const statoBorder = {
  da_fare: 'border-l-4 border-l-yellow-400',
  in_corso: 'border-l-4 border-l-blue-500',
  completata: 'border-l-4 border-l-green-400',
  bloccata: 'border-l-4 border-l-red-400',
}
const badgeCls = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'

/**
 * ActivityDataBox — Box header attività riutilizzabile (design stile ProjectDataBox)
 *
 * Props:
 * - activity: oggetto attività
 * - isAdmin: boolean
 * - onEdit: callback modifica (opzionale, admin)
 * - onDelete: callback elimina (opzionale, admin)
 * - allegati: array allegati
 * - onUploadFiles: callback upload (opzionale)
 * - onDeleteAllegato: callback delete allegato (opzionale)
 * - downloadUrl: function(allegatoId) => url
 * - uploadingFiles: boolean
 * - overdue: boolean — date in rosso
 * - tecnici: array nomi tecnici assegnati
 */
export default function ActivityDataBox({
  activity,
  isAdmin = false,
  onEdit,
  onDelete,
  allegati = [],
  onUploadFiles,
  onDeleteAllegato,
  downloadUrl,
  uploadingFiles = false,
  overdue = false,
  tecnici = [],
  // Dipendenze
  dipendenza = null,       // { id, nome, stato } — attività padre
  dipendenti = [],         // [{ id, nome, stato }] — attività figlie
  projectId = null,        // per link alle attività
  // Referenti
  referenti = [],
  clientReferenti = [],    // referenti del cliente (anagrafica)
  onAssignReferente,       // callback (refId) => add to activity
  onRemoveReferente,       // callback (refId) => remove from activity
  onCreateAndAssignReferente, // callback (form) => create new and assign
  canEditReferenti = false,
}) {
  const [openPanel, setOpenPanel] = useState(null) // 'descrizione' | 'allegati' | 'tecnici' | 'dipendenze' | 'referenti' | null
  const [showAddRef, setShowAddRef] = useState(false)
  const [showNewRefForm, setShowNewRefForm] = useState(false)
  const [newRefForm, setNewRefForm] = useState({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })

  if (!activity) return null

  const hasDipendenza = !!dipendenza
  const hasDipendenti = dipendenti && dipendenti.length > 0
  const showDipToggle = hasDipendenza || hasDipendenti
  const dipLabel = hasDipendenza ? 'Attenzione Dipendenze' : 'Attività Padre'

  const isCompleted = activity.stato === 'completata'

  return (
    <>
      {/* Box 1: Header */}
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${statoBorder[activity.stato] || ''}`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{activity.nome}</h1>
              <HelpTip text="Dettaglio attività con stato avanzamento, email associate, note e attività programmate." />
              {isAdmin && onEdit && (
                <button onClick={onEdit} className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors" title="Modifica attività">
                  <Pencil size={15} />
                </button>
              )}
              {isAdmin && onDelete && (
                <button onClick={onDelete} className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors" title="Elimina attività">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
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
        </div>

        {/* Dates */}
        <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
          {activity.data_inizio && (
            <span className={overdue ? 'text-red-600 font-semibold' : ''}>
              Inizio: <b className={overdue ? 'text-red-700' : 'text-gray-700'}>{new Date(activity.data_inizio).toLocaleDateString('it-IT')}</b>
            </span>
          )}
          {activity.data_scadenza && (
            <span className={overdue ? 'text-red-600 font-semibold' : ''}>
              Scadenza: <b className={overdue ? 'text-red-700' : 'text-gray-700'}>{new Date(activity.data_scadenza).toLocaleDateString('it-IT')}</b>
            </span>
          )}
          {isCompleted && activity.data_completamento && (
            <span>Completata: <b className="text-green-600">{new Date(activity.data_completamento).toLocaleDateString('it-IT')}</b></span>
          )}
        </div>
      </div>

      {/* Box 2: Toggles (Descrizione, Allegati, Tecnici) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {/* Toggle buttons row */}
        <div className="flex items-center gap-4">
          {activity.descrizione && (
            <button onClick={() => setOpenPanel(openPanel === 'descrizione' ? null : 'descrizione')}
              className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'descrizione' ? 'text-gray-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <ChevronRight size={14} className={`transition-transform ${openPanel === 'descrizione' ? 'rotate-90' : ''}`} />
              <FileText size={14} className={openPanel === 'descrizione' ? 'text-gray-600' : ''} />
              <span className="font-medium">Descrizione</span>
            </button>
          )}
          <button onClick={() => setOpenPanel(openPanel === 'allegati' ? null : 'allegati')}
            className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'allegati' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Paperclip size={14} className={openPanel === 'allegati' ? 'text-blue-500' : ''} />
            <span className="font-medium">Allegati Attività</span>
            {allegati.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{allegati.length}</span>}
          </button>
          {tecnici.length > 0 && (
            <button onClick={() => setOpenPanel(openPanel === 'tecnici' ? null : 'tecnici')}
              className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'tecnici' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <ChevronRight size={14} className={`transition-transform ${openPanel === 'tecnici' ? 'rotate-90' : ''}`} />
              <UserCog size={14} className={openPanel === 'tecnici' ? 'text-indigo-500' : ''} />
              <span className="font-medium">Tecnici</span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{tecnici.length}</span>
            </button>
          )}
          <button onClick={() => setOpenPanel(openPanel === 'referenti' ? null : 'referenti')}
            className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'referenti' ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <ChevronRight size={14} className={`transition-transform ${openPanel === 'referenti' ? 'rotate-90' : ''}`} />
            <Users size={14} className={openPanel === 'referenti' ? 'text-teal-500' : ''} />
            <span className="font-medium">Referenti</span>
            <span className="bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{referenti.length}</span>
          </button>
          {showDipToggle && (
            <button onClick={() => setOpenPanel(openPanel === 'dipendenze' ? null : 'dipendenze')}
              className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ml-auto ${openPanel === 'dipendenze' ? 'text-orange-600' : 'text-orange-500 hover:text-orange-700'}`}>
              <ChevronRight size={14} className={`transition-transform ${openPanel === 'dipendenze' ? 'rotate-90' : ''}`} />
              {hasDipendenza ? <AlertTriangle size={14} className={openPanel === 'dipendenze' ? 'text-orange-500' : ''} /> : <GitBranch size={14} className={openPanel === 'dipendenze' ? 'text-orange-500' : ''} />}
              <span className="font-medium">{dipLabel}</span>
            </button>
          )}
        </div>

        {/* Expanded descrizione */}
        {openPanel === 'descrizione' && activity.descrizione && (
          <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{activity.descrizione}</p>
          </div>
        )}

        {/* Expanded allegati */}
        {openPanel === 'allegati' && (
          <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            {onUploadFiles && (
              <div className="p-3 border-b border-gray-200">
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
                  <Upload size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">{uploadingFiles ? 'Caricamento...' : 'Carica allegati (clicca o trascina)'}</span>
                  <input type="file" multiple className="hidden" disabled={uploadingFiles} onChange={e => onUploadFiles(e.target.files)} />
                </label>
              </div>
            )}
            {allegati.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {allegati.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={14} className="text-gray-400 shrink-0" />
                      <span className="truncate text-gray-700">{a.nome_originale}</span>
                      <span className="text-xs text-gray-400 shrink-0">({(a.dimensione / 1024).toFixed(0)} KB)</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {downloadUrl && (
                        <a href={downloadUrl(a.id)} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded text-gray-400 hover:text-blue-600 cursor-pointer"><Download size={14} /></a>
                      )}
                      {onDeleteAllegato && (
                        <button onClick={() => onDeleteAllegato(a.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-600 cursor-pointer"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-3 text-sm text-gray-400 text-center">Nessun allegato</p>
            )}
          </div>
        )}

        {/* Expanded tecnici */}
        {openPanel === 'tecnici' && tecnici.length > 0 && (
          <div className="mt-3 bg-indigo-50 rounded-lg border border-indigo-200 overflow-hidden p-3">
            <div className="flex flex-wrap gap-2">
              {tecnici.map((t, i) => {
                const nome = typeof t === 'string' ? t : t.nome
                return (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white">
                    <UserCog size={13} /> {nome}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Expanded referenti */}
        {openPanel === 'referenti' && (
          <div className="mt-3 bg-teal-50 rounded-lg border border-teal-200 overflow-hidden">
            {referenti.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 italic">Nessun referente assegnato a questa attività</p>
            ) : (
              <div className="divide-y divide-teal-100">
                {referenti.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-teal-700">{(r.nome?.[0] || '').toUpperCase()}{(r.cognome?.[0] || '').toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{r.nome} {r.cognome}</p>
                      <p className="text-xs text-gray-500">{r.email}{r.telefono ? ` · ${r.telefono}` : ''}</p>
                    </div>
                    {r.ruolo && <span className="text-xs text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">{r.ruolo}</span>}
                    {canEditReferenti && onRemoveReferente && (
                      <button onClick={() => onRemoveReferente(r.id)} className="text-gray-400 hover:text-red-600 cursor-pointer p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEditReferenti && (
              <div className="border-t border-teal-200 p-3">
                {!showAddRef ? (
                  <button onClick={() => setShowAddRef(true)} className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800 cursor-pointer">
                    <Plus size={14} /> Aggiungi referente
                  </button>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const assignedIds = referenti.map(r => Number(r.id))
                      const available = (clientReferenti || []).filter(r => !assignedIds.includes(Number(r.id)))
                      return available.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Referenti esistenti del cliente:</p>
                          <div className="flex flex-wrap gap-1">
                            {available.map(r => (
                              <button key={r.id} onClick={() => { onAssignReferente && onAssignReferente(r.id); setShowAddRef(false) }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-teal-300 text-teal-700 hover:bg-teal-100 cursor-pointer transition-colors">
                                <Plus size={12} /> {r.nome} {r.cognome}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : <p className="text-xs text-gray-400 italic">Nessun altro referente disponibile</p>
                    })()}
                    {!showNewRefForm ? (
                      <button onClick={() => setShowNewRefForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer mt-2">
                        <User size={14} /> Crea nuovo referente
                      </button>
                    ) : (
                      <form onSubmit={e => {
                        e.preventDefault()
                        if (onCreateAndAssignReferente) onCreateAndAssignReferente(newRefForm)
                        setNewRefForm({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })
                        setShowNewRefForm(false)
                        setShowAddRef(false)
                      }} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 mt-2">
                        <p className="text-xs font-semibold text-gray-700">Nuovo referente</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Nome *" value={newRefForm.nome} onChange={e => setNewRefForm(f => ({ ...f, nome: e.target.value }))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" required />
                          <input type="text" placeholder="Cognome" value={newRefForm.cognome} onChange={e => setNewRefForm(f => ({ ...f, cognome: e.target.value }))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                          <input type="email" placeholder="Email *" value={newRefForm.email} onChange={e => setNewRefForm(f => ({ ...f, email: e.target.value }))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" required />
                          <input type="text" placeholder="Telefono" value={newRefForm.telefono} onChange={e => setNewRefForm(f => ({ ...f, telefono: e.target.value }))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                        </div>
                        <input type="text" placeholder="Ruolo (opzionale)" value={newRefForm.ruolo} onChange={e => setNewRefForm(f => ({ ...f, ruolo: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 cursor-pointer">Crea e assegna</button>
                          <button type="button" onClick={() => setShowNewRefForm(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 cursor-pointer">Annulla</button>
                        </div>
                      </form>
                    )}
                    <div className="flex justify-end mt-1">
                      <button onClick={() => setShowAddRef(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Chiudi</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expanded dipendenze */}
        {openPanel === 'dipendenze' && showDipToggle && (
          <div className="mt-3 bg-orange-50 rounded-lg border border-orange-200 overflow-hidden p-4 space-y-3">
            {hasDipendenza && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Dipende da</p>
                <Link to={`/admin/projects/${projectId}/activities/${dipendenza.id}`}
                  className="inline-flex items-center gap-2 text-xs text-orange-700 bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 hover:bg-orange-100 transition-colors">
                  {dipendenza.nome}
                  <span className={`${badgeCls} ${actStatoColors[dipendenza.stato]} text-[10px]`}>{actStatoLabels[dipendenza.stato]}</span>
                </Link>
              </div>
            )}
            {hasDipendenti && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Attività dipendenti</p>
                <div className="space-y-1">
                  {dipendenti.map(d => {
                    const childWaiting = !isCompleted
                    return (
                      <Link key={d.id} to={`/admin/projects/${projectId}/activities/${d.id}`}
                        className="flex items-center gap-2 text-xs text-blue-700 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 transition-colors">
                        {d.nome}
                        {childWaiting ? (
                          <span className={`${badgeCls} bg-gray-200 text-gray-500 text-[10px]`}>In Attesa</span>
                        ) : (
                          <span className={`${badgeCls} ${actStatoColors[d.stato]} text-[10px]`}>{actStatoLabels[d.stato]}</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
