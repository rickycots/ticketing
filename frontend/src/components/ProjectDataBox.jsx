import { useState } from 'react'
import { Paperclip, Users, UserCog, ChevronRight, Trash2, Plus, Upload, Download, X, User, FileText, Pencil, Check } from 'lucide-react'

const projectStatusConfig = {
  chiuso: { label: 'Chiuso', classes: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  attivo: { label: 'Attivo', classes: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  bloccato: { label: 'Bloccato', classes: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  bloccato_cliente: { label: 'Bloccato lato cliente', classes: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  bloccato_admin: { label: 'Bloccato lato admin', classes: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  senza_attivita: { label: 'Senza attività', classes: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
}

/**
 * ProjectDataBox — Box Dati Progetto riutilizzabile
 *
 * Props:
 * - project: oggetto progetto
 * - isAdmin: boolean
 * - onDelete: callback elimina progetto (opzionale)
 * - extraActions: JSX extra nella riga titolo (es. pulsante "Nuova Attività")
 *
 * Allegati:
 * - allegati: array
 * - onToggleAllegati: callback
 * - showAllegati: boolean
 * - onUploadFiles: callback (opzionale, admin)
 * - uploadingFiles: boolean
 * - onDeleteAllegato: callback (opzionale, admin)
 *
 * Referenti:
 * - onOpenAddRef: callback (opzionale, admin)
 * - onRemoveRef: callback (opzionale, admin)
 * - onAssignExistingRef: callback (opzionale)
 * - onCreateAndAssignRef: callback form submit (opzionale)
 * - clientReferenti: array disponibili
 *
 * Tecnici:
 * - tecnici: array utenti tecnici disponibili
 * - onTecnicoToggle: callback toggle (opzionale, admin)
 */
export default function ProjectDataBox({
  project,
  isAdmin = false,
  canEdit = false,
  onDelete,
  extraActions,
  // Allegati
  allegati = [],
  showAllegati = false,
  onToggleAllegati,
  onUploadFiles,
  uploadingFiles = false,
  onDeleteAllegato,
  // Referenti
  clientReferenti = [],
  onOpenAddRef,
  onRemoveRef,
  onAssignExistingRef,
  onCreateAndAssignRef,
  // Tecnici
  tecnici = [],
  onTecnicoToggle,
  // Nuova attività
  onCreateActivity,
  // Update project
  onUpdateProject,
}) {
  const [openPanel, setOpenPanel] = useState(null) // 'descrizione' | 'allegati' | 'referenti' | 'tecnici' | null
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [newAct, setNewAct] = useState({ nome: '', descrizione: '', priorita: 'media', assegnato_a: '', data_inizio: '', data_scadenza: '', dipende_da: '' })
  const [creatingAct, setCreatingAct] = useState(false)
  const [showAddRef, setShowAddRef] = useState(false)
  const [showNewRefForm, setShowNewRefForm] = useState(false)
  const [newRefForm, setNewRefForm] = useState({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })

  if (!project) return null

  const stato = (() => {
    if (project.blocco === 'lato_cliente') return 'bloccato_cliente'
    if (project.blocco === 'lato_admin') return 'bloccato_admin'
    const atts = project.attivita || []
    if (atts.length === 0) return 'senza_attivita'
    if (atts.every(a => a.stato === 'completata')) return 'chiuso'
    if (atts.some(a => a.stato === 'bloccata')) return 'bloccato'
    return 'attivo'
  })()
  const statusCfg = projectStatusConfig[stato] || projectStatusConfig.attivo

  return (
    <>
      {/* Box 1: Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              {editingName ? (
                <form onSubmit={async e => { e.preventDefault(); if (editName.trim() && onUpdateProject) { await onUpdateProject({ nome: editName.trim() }); setEditingName(false) } }} className="flex items-center gap-2">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                    className="text-2xl font-bold border border-blue-300 rounded-lg px-2 py-0.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <button type="submit" className="p-1 rounded-lg text-green-600 hover:bg-green-50 cursor-pointer"><Check size={18} /></button>
                  <button type="button" onClick={() => setEditingName(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"><X size={18} /></button>
                </form>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">{project.nome}</h1>
                  {isAdmin && onUpdateProject && (
                    <button onClick={() => { setEditName(project.nome); setEditingName(true) }} className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
                      <Pencil size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.classes}`}>
              <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
            {isAdmin && onDelete && (
              <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Elimina progetto">
                <Trash2 size={16} />
              </button>
            )}
            {isAdmin && onCreateActivity && (
              <button onClick={() => setShowNewActivity(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer">
                <Plus size={16} /> Nuova Attività
              </button>
            )}
            {extraActions}
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${project.avanzamento}%` }} />
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-700">{project.avanzamento}%</span>
          <span className="text-sm text-gray-400">{(project.attivita || []).length} attività</span>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
          {project.data_inizio && <span>Inizio: <b className="text-gray-700">{new Date(project.data_inizio).toLocaleDateString('it-IT')}</b></span>}
          {project.data_scadenza && <span>Scadenza: <b className="text-gray-700">{new Date(project.data_scadenza).toLocaleDateString('it-IT')}</b></span>}
          {!!project.manutenzione_ordinaria && <span className="ml-auto text-sm font-bold text-blue-600">STM Manutenzione Ordinaria</span>}
        </div>
      </div>

      {/* Box 2: Toggles */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {/* Toggle buttons row */}
        <div className="flex items-center gap-4">
          {project.descrizione && (
            <button onClick={() => { setOpenPanel(openPanel === 'descrizione' ? null : 'descrizione') }}
              className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'descrizione' ? 'text-gray-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <ChevronRight size={14} className={`transition-transform ${openPanel === 'descrizione' ? 'rotate-90' : ''}`} />
              <FileText size={14} className={openPanel === 'descrizione' ? 'text-gray-600' : ''} />
              <span className="font-medium">Descrizione</span>
            </button>
          )}
          <button onClick={() => { const opening = openPanel !== 'allegati'; setOpenPanel(opening ? 'allegati' : null); if (opening && onToggleAllegati) onToggleAllegati() }}
            className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'allegati' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <Paperclip size={14} className={openPanel === 'allegati' ? 'text-blue-500' : ''} />
            <span className="font-medium">Allegati Progetto</span>
            {allegati.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{allegati.length}</span>}
          </button>
          <button onClick={() => { setOpenPanel(openPanel === 'referenti' ? null : 'referenti') }}
            className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'referenti' ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <ChevronRight size={14} className={`transition-transform ${openPanel === 'referenti' ? 'rotate-90' : ''}`} />
            <Users size={14} className={openPanel === 'referenti' ? 'text-teal-500' : ''} />
            <span className="font-medium">Referenti</span>
            <span className="bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{(project.referenti || []).length}</span>
          </button>
          {(isAdmin || (project.tecnici || []).length > 0) && (
            <button onClick={() => { setOpenPanel(openPanel === 'tecnici' ? null : 'tecnici') }}
              className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${openPanel === 'tecnici' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <ChevronRight size={14} className={`transition-transform ${openPanel === 'tecnici' ? 'rotate-90' : ''}`} />
              <UserCog size={14} className={openPanel === 'tecnici' ? 'text-indigo-500' : ''} />
              <span className="font-medium">Tecnici</span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{(project.tecnici || []).length}</span>
            </button>
          )}
        </div>

        {/* Expanded descrizione */}
        {openPanel === 'descrizione' && project.descrizione && (
          <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{project.descrizione}</p>
          </div>
        )}

        {/* Expanded allegati */}
        {openPanel === 'allegati' && (
          <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            {(isAdmin || canEdit) && onUploadFiles && (
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
                      <a href={`/api/projects/${project.id}/allegati/${a.id}`} target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded text-gray-400 hover:text-blue-600 cursor-pointer"><Download size={14} /></a>
                      {(isAdmin || canEdit) && onDeleteAllegato && (
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

        {/* Expanded referenti */}
        {openPanel === 'referenti' && (
          <div className="mt-3 bg-teal-50 rounded-lg border border-teal-200 overflow-hidden">
            {(!project.referenti || project.referenti.length === 0) ? (
              <p className="px-4 py-3 text-sm text-gray-400 italic">Nessun referente assegnato</p>
            ) : (
              <div className="divide-y divide-teal-100">
                {project.referenti.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-teal-700">{(r.nome?.[0] || '').toUpperCase()}{(r.cognome?.[0] || '').toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{r.nome} {r.cognome}</p>
                      <p className="text-xs text-gray-500">{r.email}{r.telefono ? ` · ${r.telefono}` : ''}</p>
                    </div>
                    {r.ruolo && <span className="text-xs text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">{r.ruolo}</span>}
                    {(isAdmin || canEdit) && onRemoveRef && (
                      <button onClick={() => onRemoveRef(r.id)} className="text-gray-400 hover:text-red-600 cursor-pointer p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(isAdmin || canEdit) && onOpenAddRef && (
              <div className="border-t border-teal-200 p-3">
                {!showAddRef ? (
                  <button onClick={() => { onOpenAddRef(); setShowAddRef(true) }} className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800 cursor-pointer">
                    <Plus size={14} /> Aggiungi referente
                  </button>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const assignedIds = (project.referenti || []).map(r => r.id)
                      const available = clientReferenti.filter(r => !assignedIds.includes(r.id))
                      return available.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Referenti esistenti del cliente:</p>
                          <div className="flex flex-wrap gap-1">
                            {available.map(r => (
                              <button key={r.id} onClick={() => { onAssignExistingRef(r.id); setShowAddRef(false) }}
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
                      <form onSubmit={e => { e.preventDefault(); onCreateAndAssignRef(newRefForm); setNewRefForm({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' }); setShowNewRefForm(false); setShowAddRef(false) }}
                        className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 mt-2">
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

        {/* Expanded tecnici */}
        {openPanel === 'tecnici' && (
          <div className="mt-3 bg-indigo-50 rounded-lg border border-indigo-200 overflow-hidden">
            <div className="p-3">
              {isAdmin ? (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-2">Seleziona i tecnici abilitati su questo progetto:</p>
                  <div className="flex flex-wrap gap-2">
                    {tecnici.map(u => {
                      const assigned = (project.tecnici || []).includes(u.id)
                      return (
                        <button key={u.id} onClick={() => onTecnicoToggle && onTecnicoToggle(u.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            assigned ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                          }`}>
                          <UserCog size={13} /> {u.nome}
                        </button>
                      )
                    })}
                  </div>
                  {tecnici.length === 0 && <p className="text-xs text-gray-400 italic">Nessun tecnico disponibile</p>}
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-2">Tecnici abilitati su questo progetto:</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      // Build names from tecnici prop or from activity data
                      const ids = (project.tecnici || []).map(Number)
                      const namesFromList = tecnici.filter(u => ids.includes(Number(u.id)))
                      if (namesFromList.length > 0) return namesFromList.map(u => (
                        <span key={u.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white">
                          <UserCog size={13} /> {u.nome}
                        </span>
                      ))
                      // Fallback: extract names from activities
                      const nameMap = new Map()
                      ;(project.attivita || []).forEach(a => {
                        if (a.assegnato_a && a.assegnato_nome && ids.includes(Number(a.assegnato_a))) nameMap.set(Number(a.assegnato_a), a.assegnato_nome)
                      })
                      return [...nameMap.entries()].map(([id, nome]) => (
                        <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white">
                          <UserCog size={13} /> {nome}
                        </span>
                      ))
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Popup Nuova Attività */}
      {showNewActivity && onCreateActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewActivity(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold">Nuova Attività</h2>
              <button onClick={() => setShowNewActivity(false)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault()
              setCreatingAct(true)
              try {
                await onCreateActivity(newAct)
                setNewAct({ nome: '', descrizione: '', priorita: 'media', assegnato_a: '', data_inizio: '', data_scadenza: '', dipende_da: '' })
                setShowNewActivity(false)
              } catch (err) { alert(err.message) }
              finally { setCreatingAct(false) }
            }} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input type="text" value={newAct.nome} onChange={e => setNewAct(f => ({ ...f, nome: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nome dell'attività" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea value={newAct.descrizione} onChange={e => setNewAct(f => ({ ...f, descrizione: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={3} placeholder="Descrizione opzionale..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
                  <select value={newAct.priorita} onChange={e => setNewAct(f => ({ ...f, priorita: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="bassa">Bassa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assegnato a</label>
                  <select value={newAct.assegnato_a} onChange={e => setNewAct(f => ({ ...f, assegnato_a: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Non assegnato</option>
                    {tecnici.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
              {(project.attivita || []).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dipende da</label>
                  <select value={newAct.dipende_da} onChange={e => {
                    const depId = e.target.value
                    const update = { dipende_da: depId }
                    if (depId) {
                      const parentAct = (project.attivita || []).find(a => String(a.id) === String(depId))
                      if (parentAct && parentAct.data_scadenza) {
                        update.data_inizio = parentAct.data_scadenza
                      }
                    }
                    setNewAct(f => ({ ...f, ...update }))
                  }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Nessuna dipendenza</option>
                    {(project.attivita || []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                  <input type="date" value={newAct.data_inizio} onChange={e => setNewAct(f => ({ ...f, data_inizio: e.target.value }))}
                    disabled={!!newAct.dipende_da}
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${newAct.dipende_da ? 'bg-gray-100 text-gray-500' : ''}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                  <input type="date" value={newAct.data_scadenza} onChange={e => setNewAct(f => ({ ...f, data_scadenza: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewActivity(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">Annulla</button>
                <button type="submit" disabled={creatingAct || !newAct.nome.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  <Plus size={16} /> {creatingAct ? 'Creazione...' : 'Crea Attività'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
