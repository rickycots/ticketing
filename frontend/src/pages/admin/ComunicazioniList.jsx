import { useState, useEffect } from 'react'
import { Megaphone, Plus, Trash2, X, AlertTriangle, Eye, Clock } from 'lucide-react'
import { comunicazioni, clients } from '../../api/client'

export default function ComunicazioniList() {
  const [list, setList] = useState([])
  const [clientList, setClientList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', oggetto: '', corpo: '', importante: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  function loadData() {
    setLoading(true)
    Promise.all([
      comunicazioni.list(),
      clients.list(),
    ]).then(([comms, cls]) => {
      setList(comms)
      setClientList(Array.isArray(cls) ? cls : cls.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.cliente_id || !form.oggetto.trim()) {
      setError('Seleziona un cliente e inserisci il titolo')
      return
    }
    setSaving(true)
    setError('')
    try {
      const created = await comunicazioni.create(form)
      setList(prev => [created, ...prev])
      setForm({ cliente_id: '', oggetto: '', corpo: '', importante: false })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminare questa comunicazione?')) return
    try {
      await comunicazioni.remove(id)
      setList(prev => prev.filter(c => c.id !== id))
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Megaphone size={24} className="text-blue-600" />
          <h1 className="page-title">Comunicazioni</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          <Plus size={16} />
          Nuova Comunicazione
        </button>
      </div>

      {/* Form modale */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nuova Comunicazione</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">Cliente</label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="form-input"
                >
                  <option value="">— Seleziona cliente —</option>
                  {clientList.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_azienda}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Titolo</label>
                <input
                  type="text"
                  value={form.oggetto}
                  onChange={e => setForm(f => ({ ...f, oggetto: e.target.value }))}
                  className="form-input"
                  placeholder="Oggetto della comunicazione"
                />
              </div>
              <div>
                <label className="field-label">Testo</label>
                <textarea
                  value={form.corpo}
                  onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))}
                  className="form-input"
                  rows={5}
                  placeholder="Contenuto della comunicazione (opzionale)"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.importante}
                  onChange={e => setForm(f => ({ ...f, importante: e.target.checked }))}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <AlertTriangle size={14} className="text-red-500" />
                  Comunicazione importante
                </span>
                <span className="text-xs text-gray-400 ml-1">(resta visibile anche se letta, fino a scadenza 15gg)</span>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowForm(false); setError('') }} className="btn-secondary">Annulla</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Invio...' : 'Invia Comunicazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <Megaphone size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nessuna comunicazione</p>
          <p className="text-sm text-gray-400 mt-1">Clicca "Nuova Comunicazione" per inviarne una ai clienti</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Cliente</th>
                <th className="th">Titolo</th>
                <th className="th">Data</th>
                <th className="th">Mittente</th>
                <th className="th text-center">Letture</th>
                <th className="th text-center">Imp.</th>
                <th className="th text-center">Stato</th>
                <th className="th w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(c => {
                const dataRic = new Date(c.data_ricezione)
                const scadenza = new Date(dataRic.getTime() + 15 * 24 * 60 * 60 * 1000)
                const now = new Date()
                const scaduto = now > scadenza
                const giorniRimasti = Math.max(0, Math.ceil((scadenza - now) / (1000 * 60 * 60 * 24)))
                const tuttiLetti = c.totale_utenti > 0 && c.letti >= c.totale_utenti
                return (
                <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${scaduto ? 'opacity-50' : ''}`}>
                  <td className="td font-medium text-gray-900">{c.nome_azienda}</td>
                  <td className="td">
                    <div>
                      <p className="font-medium text-gray-900">{c.oggetto}</p>
                      {c.corpo && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.corpo}</p>}
                    </div>
                  </td>
                  <td className="td text-gray-500 whitespace-nowrap">
                    {dataRic.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="td text-gray-500">{c.mittente || '—'}</td>
                  <td className="td text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tuttiLetti ? 'text-green-600' : 'text-gray-500'}`}>
                      <Eye size={13} />
                      {c.letti}/{c.totale_utenti}
                    </span>
                  </td>
                  <td className="td text-center">
                    {c.importante ? <AlertTriangle size={15} className="text-red-500 inline" /> : null}
                  </td>
                  <td className="td text-center whitespace-nowrap">
                    {scaduto ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                        <Clock size={13} />
                        Scaduta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <Clock size={13} />
                        {giorniRimasti}gg
                      </span>
                    )}
                  </td>
                  <td className="td">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Elimina"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
