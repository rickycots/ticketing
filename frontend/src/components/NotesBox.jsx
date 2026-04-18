import { useState } from 'react'
import { StickyNote, ChevronDown, ChevronRight } from 'lucide-react'

export default function NotesBox({
  title = 'Note',
  notes = [],
  canAdd = true,
  canSaveKB = false,
  showBloccante = false,
  showSblocca = false,
  onAdd,
}) {
  const [open, setOpen] = useState(false)
  const [order, setOrder] = useState('vecchi')
  const [text, setText] = useState('')
  const [kb, setKb] = useState(false)
  const [bloccante, setBloccante] = useState(false)
  const [sblocca, setSblocca] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await onAdd(text.trim(), { salva_in_kb: kb, is_bloccante: bloccante, sblocca })
      setText('')
      setKb(false)
      setBloccante(false)
      setSblocca(false)
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const sortedNotes = order === 'nuovi' ? [...notes].reverse() : notes

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 flex items-center justify-between">
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -ml-2">
          <StickyNote size={18} className="text-yellow-500" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-gray-400">({notes.length})</span>
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        </button>
        {open && notes.length > 1 && (
          <button onClick={() => setOrder(o => o === 'vecchi' ? 'nuovi' : 'vecchi')}
            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
            {order === 'vecchi' ? 'Vecchi → Nuovi' : 'Nuovi → Vecchi'}
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-gray-100">
          {notes.length > 0 && (
            <div className="divide-y divide-gray-100">
              {sortedNotes.map(n => (
                <div key={n.id} className={`p-4 ${n.is_bloccante ? 'bg-red-50/50 border-l-4 border-l-red-400' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-700">{n.utente_nome}</p>
                      {!!n.is_bloccante && <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">NOTA BLOCCANTE</span>}
                    </div>
                    <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString('it-IT')}</p>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.testo}</p>
                </div>
              ))}
            </div>
          )}
          {canAdd && (
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 space-y-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Aggiungi una nota..." rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  {showBloccante && (
                    <label className="flex items-center gap-2 text-xs text-orange-600 cursor-pointer select-none font-medium">
                      <input type="checkbox" checked={bloccante} onChange={(e) => { setBloccante(e.target.checked); if (e.target.checked) setSblocca(false) }}
                        className="rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
                      Nota bloccante
                    </label>
                  )}
                  {showSblocca && (
                    <label className="flex items-center gap-2 text-xs text-green-600 cursor-pointer select-none font-medium">
                      <input type="checkbox" checked={sblocca} onChange={(e) => { setSblocca(e.target.checked); if (e.target.checked) setBloccante(false) }}
                        className="rounded border-green-300 text-green-600 focus:ring-green-500" />
                      Sblocca nota
                    </label>
                  )}
                  {canSaveKB && (
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                      <input type="checkbox" checked={kb} onChange={(e) => setKb(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      Salva in KB
                    </label>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={sending || !text.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    <StickyNote size={14} /> {sending ? 'Salvataggio...' : 'Aggiungi Nota'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
