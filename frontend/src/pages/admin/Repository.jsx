import { useState, useEffect, useRef, useCallback } from 'react'
import { BookOpen, Upload, Trash2, Download, Pencil, X, Save, FileText, Filter, ChevronRight } from 'lucide-react'
import { repository } from '../../api/client'
import HelpTip from '../../components/HelpTip'

const badgeCls = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function Repository() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [categorie, setCategorie] = useState([])
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [page, setPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadCategoria, setUploadCategoria] = useState('Altro')
  const [uploadDescrizione, setUploadDescrizione] = useState('')
  const [editingDoc, setEditingDoc] = useState(null)
  const [editForm, setEditForm] = useState({ categoria: '', descrizione: '' })
  const [expandedDoc, setExpandedDoc] = useState(null)
  const fileInputRef = useRef()
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  useEffect(() => { loadDocs(); loadCategorie() }, [filtroCategoria])

  function loadDocs() {
    setLoading(true)
    const params = filtroCategoria ? { categoria: filtroCategoria } : {}
    repository.list(params).then(setDocs).catch(console.error).finally(() => setLoading(false))
  }

  function loadCategorie() {
    repository.categorie().then(setCategorie).catch(() => {})
  }

  const handleUpload = useCallback(async (files) => {
    if (!files.length) return
    setUploading(true)
    try {
      await repository.upload(Array.from(files), uploadCategoria, uploadDescrizione)
      setUploadDescrizione('')
      loadDocs()
      loadCategorie()
    } catch (err) { console.error(err) }
    finally { setUploading(false) }
  }, [uploadCategoria, uploadDescrizione])

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (!isAdmin) return
    handleUpload(e.dataTransfer.files)
  }

  function handleDragOver(e) { e.preventDefault(); if (isAdmin) setDragOver(true) }
  function handleDragLeave() { setDragOver(false) }

  async function handleDelete(id) {
    if (!confirm('Eliminare questo documento?')) return
    try { await repository.delete(id); loadDocs() } catch (err) { console.error(err) }
  }

  function startEdit(doc) {
    setEditingDoc(doc.id)
    setExpandedDoc(doc.id)
    const validCats = ['Accessi', 'TVCC', 'Altro']
    setEditForm({ categoria: validCats.includes(doc.categoria) ? doc.categoria : 'Altro', descrizione: doc.descrizione || '' })
  }

  async function saveEdit(id) {
    try {
      await repository.update(id, editForm)
      setEditingDoc(null)
      loadDocs()
      loadCategorie()
    } catch (err) { console.error(err) }
  }

  function handleDownload(doc) {
    const token = sessionStorage.getItem('token')
    const url = repository.downloadUrl(doc.id)
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = doc.nome_originale
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen size={24} /> Repository Documenti <HelpTip text="Archivio documenti tecnici dei fornitori. I file PDF/TXT vengono analizzati automaticamente e il testo estratto viene utilizzato dall'AI per rispondere alle domande. La colonna 'AI' mostra ✓ se il documento è indicizzato." />
        </h1>
      </div>

      {/* Upload zone (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold mb-3">Carica Documenti</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
              <select value={uploadCategoria} onChange={e => setUploadCategoria(e.target.value)} className={inputCls}>
                <option value="Accessi">Accessi</option>
                <option value="TVCC">TVCC</option>
                <option value="Altro">Altro</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrizione (opzionale)</label>
              <input type="text" value={uploadDescrizione} onChange={e => setUploadDescrizione(e.target.value)}
                placeholder="Breve descrizione dei documenti..." className={inputCls} />
            </div>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
          >
            <Upload size={32} className={`mx-auto mb-2 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-600">
              {uploading ? 'Caricamento in corso...' : 'Trascina i file qui oppure clicca per selezionare'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Formati: .txt, .pdf, .doc, .docx, .md — Max 20MB per file</p>
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".txt,.pdf,.doc,.docx,.md"
            onChange={e => { handleUpload(e.target.files); e.target.value = '' }}
            className="hidden" />
          <p className="text-xs text-gray-400 mt-3 italic">*L'estrazione del testo da parte della AI funziona solo con file .txt, .md e .pdf</p>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter size={16} className="text-gray-400" />
        {['', 'Accessi', 'TVCC', 'Altro'].map(cat => (
          <button key={cat} onClick={() => { setFiltroCategoria(cat); setPage(1) }}
            className={`${badgeCls} cursor-pointer ${filtroCategoria === cat ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {cat || 'Tutti'}
          </button>
        ))}
      </div>

      {/* Documents table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nessun documento nel repository</div>
        ) : (() => {
          const PAGE_SIZE = 10
          const totalPages = Math.ceil(docs.length / PAGE_SIZE)
          const paginatedDocs = docs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Dimensione</th>
                  <th className="px-4 py-3 font-medium text-center">AI</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedDocs.map(doc => (
                  <>
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                            className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
                          >
                            <ChevronRight size={14} className={`transition-transform ${expandedDoc === doc.id ? 'rotate-90' : ''}`} />
                          </button>
                          <FileText size={16} className="text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 truncate">{doc.nome_originale}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingDoc === doc.id ? (
                          <select value={editForm.categoria} onChange={e => setEditForm(f => ({ ...f, categoria: e.target.value }))}
                            className="rounded border border-gray-300 px-2 py-1 text-xs">
                            <option value="Accessi">Accessi</option>
                            <option value="TVCC">TVCC</option>
                            <option value="Altro">Altro</option>
                          </select>
                        ) : (
                          <span className={`${badgeCls} bg-gray-100 text-gray-700`}>{doc.categoria}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatSize(doc.dimensione)}</td>
                      <td className="px-4 py-3 text-center">
                        {!!doc.ai_parsed ? (
                          <span className="text-green-500" title="Testo estratto per AI">✓</span>
                        ) : (
                          <span className="text-gray-300" title="Testo non disponibile per AI">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(doc.created_at).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {editingDoc === doc.id ? (
                            <>
                              <button onClick={() => saveEdit(doc.id)} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 cursor-pointer" title="Salva">
                                <Save size={14} />
                              </button>
                              <button onClick={() => { setEditingDoc(null); setExpandedDoc(null) }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer" title="Annulla">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleDownload(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer" title="Scarica">
                                <Download size={14} />
                              </button>
                              {isAdmin && (
                                <>
                                  <button onClick={() => startEdit(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer" title="Modifica">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" title="Elimina">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedDoc === doc.id && (
                      <tr key={`${doc.id}-desc`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 pb-3 pt-0 pl-14">
                          {editingDoc === doc.id ? (
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Descrizione</label>
                              <input type="text" value={editForm.descrizione} onChange={e => setEditForm(f => ({ ...f, descrizione: e.target.value }))}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Aggiungi una descrizione..." />
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              {doc.descrizione || 'Nessuna descrizione'}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default cursor-pointer"
                >
                  ← Prec
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default cursor-pointer"
                >
                  Succ →
                </button>
              </div>
            )}
          </div>
          )
        })()}
      </div>
    </div>
  )
}
