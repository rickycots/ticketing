import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Paperclip, X } from 'lucide-react'
import { clientTickets } from '../../api/client'

const categorie = [
  { value: 'assistenza', label: 'Assistenza' },
  { value: 'bug', label: 'Bug / Malfunzionamento' },
  { value: 'richiesta_info', label: 'Richiesta Informazioni' },
  { value: 'altro', label: 'Altro' },
]

export default function TicketForm() {
  const { slug } = useParams()
  const [form, setForm] = useState({
    oggetto: '',
    categoria: '',
    priorita: 'media',
    descrizione: '',
  })
  const [files, setFiles] = useState([])
  const fileInputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')

  function handleFilesChange(e) {
    const selected = Array.from(e.target.files)
    setFiles(prev => {
      const combined = [...prev, ...selected]
      return combined.slice(0, 5) // max 5 files
    })
    e.target.value = ''
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await clientTickets.create(form, files.length > 0 ? files : null)
      setSuccess(result)
      setForm({ oggetto: '', categoria: '', priorita: 'media', descrizione: '' })
      setFiles([])
    } catch (err) {
      setError(err.message || 'Errore durante l\'invio del ticket')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-8 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Ticket Inviato!</h2>
          <p className="text-gray-600 mb-4">
            Il tuo ticket è stato registrato con il codice:
          </p>
          <p className="text-2xl font-mono font-bold text-blue-600 mb-6">{success.codice}</p>
          <p className="text-sm text-gray-500 mb-6">
            Riceverai una risposta il prima possibile. Puoi usare questo codice per riferimento.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="bg-blue-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Apri un altro ticket
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold mb-1">Apri un Nuovo Ticket</h2>
        <p className="text-sm text-gray-500 mb-6">
          Compila il form per inviare una richiesta di assistenza.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Oggetto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.oggetto}
              onChange={(e) => setForm(f => ({ ...f, oggetto: e.target.value }))}
              maxLength={200}
              required
              placeholder="Descrivi brevemente il problema"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                value={form.categoria}
                onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seleziona...</option>
                {categorie.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
              <select
                value={form.priorita}
                onChange={(e) => setForm(f => ({ ...f, priorita: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.descrizione}
              onChange={(e) => setForm(f => ({ ...f, descrizione: e.target.value }))}
              required
              rows={6}
              placeholder="Descrivi il problema nel dettaglio..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Allegati */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allegati</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.xlsx,.zip"
              onChange={handleFilesChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 5}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <Paperclip size={14} /> Aggiungi file {files.length > 0 && `(${files.length}/5)`}
            </button>
            <p className="text-xs text-gray-400 mt-1">Max 5 file, 10MB ciascuno. Formati: jpg, png, gif, pdf, doc, docx, txt, xlsx, zip</p>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                    <Paperclip size={12} className="text-gray-400" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Invio in corso...' : 'Invia Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
