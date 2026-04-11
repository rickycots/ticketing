import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, Paperclip, X, CheckCircle } from 'lucide-react'
import { emails, projects as projectsApi, clients } from '../../api/client'
import HelpTip from '../../components/HelpTip'

export default function SendMail() {
  const [searchParams] = useSearchParams()
  const [clientList, setClientList] = useState([])
  const [projectList, setProjectList] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [projectDetail, setProjectDetail] = useState(null)
  const [activities, setActivities] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedEmails, setSelectedEmails] = useState([])
  const [form, setForm] = useState({
    oggetto: '', corpo: '',
    cliente_id: searchParams.get('cliente_id') || '',
    progetto_id: searchParams.get('progetto_id') || '',
    attivita_id: searchParams.get('attivita_id') || '',
    is_bloccante: false,
  })
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const user = JSON.parse(sessionStorage.getItem('user') || '{}')

  // Pre-filled params from URL — these selects will be locked
  const preCliente = searchParams.get('cliente_id') || ''
  const preProgetto = searchParams.get('progetto_id') || ''
  const preAttivita = searchParams.get('attivita_id') || ''
  const isPreFilled = !!(preCliente || preProgetto)

  useEffect(() => {
    clients.list({ limit: 999 }).then(res => setClientList(res.data || [])).catch(console.error)
    projectsApi.list({ limit: 999 }).then(res => setAllProjects(res.data || [])).catch(console.error)
  }, [])

  // Initialize form from URL params once projects are loaded
  useEffect(() => {
    if (initialized || allProjects.length === 0) return

    let clienteId = preCliente
    const progettoId = preProgetto
    const attivitaId = preAttivita

    // If no cliente_id but we have progetto_id, find it from projects
    if (!clienteId && progettoId) {
      const p = allProjects.find(p => String(p.id) === progettoId)
      if (p) clienteId = String(p.cliente_id)
    }

    if (clienteId) {
      setProjectList(allProjects.filter(p => String(p.cliente_id) === String(clienteId)))
      setForm(f => ({ ...f, cliente_id: clienteId, progetto_id: progettoId, attivita_id: attivitaId }))
    }

    setInitialized(true)
  }, [allProjects])

  // Filter projects by selected client (only for manual changes, not initial)
  useEffect(() => {
    if (!initialized) return
    if (form.cliente_id) {
      setProjectList(allProjects.filter(p => String(p.cliente_id) === String(form.cliente_id)))
    } else {
      setProjectList([])
    }
    // Only reset if user manually changed the client (not pre-filled)
    if (!isPreFilled) {
      setForm(f => ({ ...f, progetto_id: '', attivita_id: '' }))
      setProjectDetail(null)
      setActivities([])
      setContacts([])
      setSelectedEmails([])
    }
  }, [form.cliente_id, allProjects, initialized])

  // When project changes, load detail
  useEffect(() => {
    if (form.progetto_id) {
      projectsApi.get(form.progetto_id).then(p => {
        setProjectDetail(p)
        setActivities(p.attivita || [])
        const contactsList = []
        if (p.referenti && p.referenti.length > 0) {
          p.referenti.forEach(r => {
            if (r.email) contactsList.push({ email: r.email, label: `${r.nome} ${r.cognome || ''}`.trim(), tipo: 'Referente' })
          })
        }
        if (p.cliente_email) {
          contactsList.push({ email: p.cliente_email, label: p.cliente_nome || p.cliente_email, tipo: 'Cliente' })
        }
        setContacts(contactsList)
        setSelectedEmails([])
      }).catch(() => {
        setProjectDetail(null)
        setActivities([])
        setContacts([])
      })
    } else {
      setProjectDetail(null)
      setActivities([])
      setContacts([])
      setSelectedEmails([])
    }
  }, [form.progetto_id])

  // Load utenti_cliente (admin only)
  useEffect(() => {
    if (projectDetail && projectDetail.cliente_id && user.ruolo === 'admin') {
      clients.getUsers(projectDetail.cliente_id).then(users => {
        const clientContacts = (users || []).filter(u => u.attivo && u.email).map(u => ({
          email: u.email, label: u.nome, tipo: 'Utente portale'
        }))
        setContacts(prev => {
          const existingEmails = new Set(prev.map(c => c.email.toLowerCase()))
          const newContacts = clientContacts.filter(c => !existingEmails.has(c.email.toLowerCase()))
          return [...prev, ...newContacts]
        })
      }).catch(() => {})
    }
  }, [projectDetail?.cliente_id])

  function toggleEmail(email) {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (selectedEmails.length === 0) return alert('Seleziona almeno un destinatario')
    setSending(true)
    try {
      const emailFooter = '\n\n---\nRicevi questo messaggio dal portale GestioneProgetti di STM Domotica Corporation srl. Una attivita/progetto inerente la tua azienda richiede il tuo supporto. Se desideri essere abilitato al portale lato Cliente contatta i tuoi referenti.'
      const data = {
        tipo: 'inviata',
        destinatario: selectedEmails.join(', '),
        oggetto: form.oggetto,
        corpo: (form.corpo || '') + emailFooter,
        cliente_id: form.cliente_id || null,
        progetto_id: form.progetto_id || null,
        attivita_id: form.attivita_id || null,
        is_bloccante: form.is_bloccante ? '1' : '0',
      }
      await emails.create(data, files)
      setSent(true)
      setForm({ oggetto: '', corpo: '', cliente_id: '', progetto_id: '', attivita_id: '', is_bloccante: false })
      setFiles([])
      setSelectedEmails([])
      setContacts([])
      setTimeout(() => setSent(false), 3000)
    } catch (err) { alert(err.message) }
    finally { setSending(false) }
  }

  function removeFile(idx) {
    setFiles(f => f.filter((_, i) => i !== idx))
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const selectCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2 shrink-0">
          <Send size={22} className="text-blue-600" />
          Invia Mail
          <HelpTip text="Invia email tramite assistenzatecnica@stmdomotica.it. Seleziona cliente, progetto e attività. I destinatari vengono proposti dai referenti progetto, email cliente e utenti portale." />
        </h1>
        <p className="text-[11px] text-gray-400 italic leading-snug max-w-[600px]">
          Qui si inviano mail da assistenzatecnica@stmdomotica.it; è possibile mandare solo mail riferite a progetti o attività.
        </p>
      </div>

      {sent && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle size={16} /> Email inviata con successo
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        {/* Cliente + Project + Activity */}
        <div className="space-y-3 max-w-[50%]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required disabled={!!preCliente} className={`${selectCls} ${preCliente ? 'bg-gray-100' : ''}`}>
              <option value="">— Seleziona cliente —</option>
              {clientList.map(c => <option key={c.id} value={c.id}>{c.nome_azienda}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Progetto *</label>
            <select value={form.progetto_id} onChange={e => setForm(f => ({ ...f, progetto_id: e.target.value }))} required disabled={!!preProgetto || !form.cliente_id} className={`${selectCls} ${preProgetto ? 'bg-gray-100' : !form.cliente_id ? 'opacity-50' : ''}`}>
              <option value="">— Seleziona progetto —</option>
              {projectList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attività *</label>
            <select value={form.attivita_id} onChange={e => setForm(f => ({ ...f, attivita_id: e.target.value }))} required disabled={!!preAttivita || !form.progetto_id} className={`${selectCls} ${preAttivita ? 'bg-gray-100' : !form.progetto_id ? 'opacity-50' : ''}`}>
              <option value="">— Seleziona attività —</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destinatari * {selectedEmails.length > 0 && <span className="text-blue-600">({selectedEmails.length})</span>}</label>
          {!form.progetto_id ? (
            <p className="text-sm text-gray-400 italic">Seleziona cliente e progetto per vedere i destinatari disponibili</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nessun contatto trovato per questo progetto</p>
          ) : (
            <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
              {contacts.map(c => (
                <label key={c.email} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                  <input type="checkbox" checked={selectedEmails.includes(c.email)} onChange={() => toggleEmail(c.email)} className="rounded border-gray-300" />
                  <span className="font-medium text-gray-800">{c.label}</span>
                  <span className="text-gray-400">{c.email}</span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    c.tipo === 'Referente' ? 'bg-blue-50 text-blue-600' : c.tipo === 'Cliente' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                  }`}>{c.tipo}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto *</label>
          <input type="text" required value={form.oggetto} onChange={e => setForm(f => ({ ...f, oggetto: e.target.value }))} className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio</label>
          <textarea rows={8} value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} className={`${inputCls} rounded-b-none border-b-0`} />
          <div className="border border-t-0 border-gray-300 rounded-b-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-400 leading-relaxed select-none">
            Ricevi questo messaggio dal portale GestioneProgetti di STM Domotica Corporation srl. Una attivita/progetto inerente la tua azienda richiede il tuo supporto. Se desideri essere abilitato al portale lato Cliente contatta i tuoi referenti.
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_bloccante} onChange={e => setForm(f => ({ ...f, is_bloccante: e.target.checked }))} className="rounded border-gray-300" />
            <span className="text-orange-600 font-medium">Email bloccante</span>
            <HelpTip size={12} text="Se attivata, l'attività associata passerà automaticamente allo stato 'Bloccata'. Questo stato è visibile anche dal cliente nel portale." />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:text-blue-700">
            <Paperclip size={16} />
            <span>Allega file</span>
            <input type="file" multiple className="hidden" onChange={e => setFiles(f => [...f, ...Array.from(e.target.files)])} />
          </label>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-600">
                {f.name}
                <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={sending || selectedEmails.length === 0} className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            <Send size={16} />
            {sending ? 'Invio in corso...' : 'Invia Email'}
          </button>
          <span className="text-xs text-gray-400">Da: assistenzatecnica@stmdomotica.it (Admin del portale riceverà una copia)</span>
        </div>
      </form>
    </div>
  )
}
