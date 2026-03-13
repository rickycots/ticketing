import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, Plus, Pencil, X, Save, Building2, UserCircle, Calendar, BookOpen, Ticket, BarChart3, Users } from 'lucide-react'
import { clients, schede as schedeApi, clientAuth } from '../../api/client'

const API_BASE = '/api'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [users, setUsers] = useState([])
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ nome: '', email: '', password: '', ruolo: 'user', schede_visibili: 'ticket,progetti,ai', lingua: 'it', cambio_password: 1, two_factor: 0 })
  const fileRef = useRef()

  // Knowledge Base state
  const [kbList, setKbList] = useState([])
  const [showKbForm, setShowKbForm] = useState(false)
  const [editingKb, setEditingKb] = useState(null)
  const [kbForm, setKbForm] = useState({ titolo: '', contenuto: '' })
  const [savingKb, setSavingKb] = useState(false)
  const [expandedKb, setExpandedKb] = useState(null)

  // Referenti state
  const [referenti, setReferenti] = useState([])
  const [showRefForm, setShowRefForm] = useState(false)
  const [editingRef, setEditingRef] = useState(null)
  const [refForm, setRefForm] = useState({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })

  useEffect(() => {
    loadClient()
    loadUsers()
    loadKb()
    loadReferenti()
  }, [id])

  function loadClient() {
    setLoading(true)
    clients.get(id)
      .then(c => {
        setClient(c)
        setForm({
          nome_azienda: c.nome_azienda,
          portale_slug: c.portale_slug || '',
          referente: c.referente || '',
          email: c.email,
          telefono: c.telefono || '',
          indirizzo: c.indirizzo || '',
          citta: c.citta || '',
          provincia: c.provincia || '',
          sla_reazione: c.sla_reazione || 'nb',
          note: c.note || '',
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function loadUsers() {
    clients.getUsers(id).then(setUsers).catch(console.error)
  }

  function loadKb() {
    schedeApi.list(id).then(setKbList).catch(console.error)
  }

  function loadReferenti() {
    clients.getReferenti(id).then(setReferenti).catch(console.error)
  }

  function openRefForm(ref = null) {
    if (ref) {
      setEditingRef(ref)
      setRefForm({ nome: ref.nome, cognome: ref.cognome || '', email: ref.email, telefono: ref.telefono || '', ruolo: ref.ruolo || '' })
    } else {
      setEditingRef(null)
      setRefForm({ nome: '', cognome: '', email: '', telefono: '', ruolo: '' })
    }
    setShowRefForm(true)
  }

  async function handleRefSubmit(e) {
    e.preventDefault()
    if (!refForm.nome.trim() || !refForm.email.trim()) return
    try {
      if (editingRef) {
        await clients.updateReferente(id, editingRef.id, refForm)
      } else {
        await clients.createReferente(id, refForm)
      }
      setShowRefForm(false)
      setEditingRef(null)
      loadReferenti()
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteRef(refId) {
    if (!confirm('Eliminare questo referente?')) return
    try { await clients.deleteReferente(id, refId); loadReferenti() } catch (err) { console.error(err) }
  }

  function openKbForm(kb = null) {
    if (kb) {
      setEditingKb(kb)
      setKbForm({ titolo: kb.titolo, contenuto: kb.contenuto })
    } else {
      setEditingKb(null)
      setKbForm({ titolo: '', contenuto: '' })
    }
    setShowKbForm(true)
  }

  async function handleKbSubmit(e) {
    e.preventDefault()
    if (!kbForm.titolo.trim() || !kbForm.contenuto.trim()) return
    setSavingKb(true)
    try {
      if (editingKb) {
        await schedeApi.update(id, editingKb.id, kbForm)
      } else {
        await schedeApi.create(id, kbForm)
      }
      setShowKbForm(false)
      setEditingKb(null)
      loadKb()
    } catch (err) { alert(err.message) }
    finally { setSavingKb(false) }
  }

  async function handleDeleteKb(kbId) {
    if (!confirm('Eliminare questa scheda?')) return
    try { await schedeApi.delete(id, kbId); loadKb() } catch (err) { console.error(err) }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await clients.update(id, form)
      setClient(updated)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const updated = await clients.uploadLogo(id, file)
      setClient(updated)
    } catch (err) { console.error(err) }
    e.target.value = ''
  }

  async function handleLogoDelete() {
    try {
      const updated = await clients.deleteLogo(id)
      setClient(updated)
    } catch (err) { console.error(err) }
  }

  function openUserForm(user = null) {
    if (user) {
      setEditingUser(user)
      setUserForm({ nome: user.nome, email: user.email, password: '', ruolo: user.ruolo || 'user', schede_visibili: user.schede_visibili, lingua: user.lingua || 'it', cambio_password: user.cambio_password ?? 1, two_factor: user.two_factor ?? 0 })
    } else {
      setEditingUser(null)
      setUserForm({ nome: '', email: '', password: '', ruolo: 'user', schede_visibili: 'ticket,progetti,ai', lingua: 'it', cambio_password: 1, two_factor: 0 })
    }
    setShowUserForm(true)
  }

  async function handleUserSubmit(e) {
    e.preventDefault()
    try {
      if (editingUser) {
        const data = { ...userForm }
        if (!data.password) delete data.password
        await clients.updateUser(id, editingUser.id, data)
      } else {
        await clients.createUser(id, userForm)
      }
      setShowUserForm(false)
      loadUsers()
    } catch (err) { alert(err.message) }
  }

  async function handleDeleteUser(userId) {
    if (!confirm('Eliminare questo utente?')) return
    try {
      await clients.deleteUser(id, userId)
      loadUsers()
    } catch (err) { console.error(err) }
  }

  async function handleToggleActive(user) {
    try {
      await clients.updateUser(id, user.id, { attivo: user.attivo ? 0 : 1 })
      loadUsers()
    } catch (err) { console.error(err) }
  }

  function toggleScheda(scheda) {
    const current = userForm.schede_visibili.split(',').filter(Boolean)
    const updated = current.includes(scheda)
      ? current.filter(s => s !== scheda)
      : [...current, scheda]
    setUserForm(f => ({ ...f, schede_visibili: updated.join(',') || 'ticket' }))
  }

  async function handleImpersonate() {
    // Open window immediately (in click context) to avoid popup blocker
    const w = window.open('about:blank', '_blank')
    try {
      const data = await clientAuth.impersonate(id)
      sessionStorage.setItem('clientToken', data.token)
      sessionStorage.setItem('clientUser', JSON.stringify(data.user))
      w.location.href = '/client'
    } catch (err) {
      if (w) w.close()
      alert('Errore durante l\'accesso al portale cliente')
      console.error(err)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Caricamento...</div>
  if (!client) return <div className="text-center py-12 text-gray-400">Cliente non trovato</div>

  const logoUrl = client.logo ? `${import.meta.env.VITE_API_BASE || '/api'}/uploads/logos/${client.logo}` : null

  return (
    <div>
      <Link to="/admin/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Torna ai clienti
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">{client.nome_azienda}</h1>
          {client.created_at && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar size={14} />
              Cliente dal {new Date(client.created_at).toLocaleDateString('it-IT')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImpersonate}
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-teal-700 transition-colors cursor-pointer"
          >
            <Ticket size={14} /> Accedi Ticketing/Progetti
          </button>
          <button
            onClick={() => window.open('/client/login', '_blank')}
            className="inline-flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <BarChart3 size={14} /> Dashboard Sistemi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info Form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Building2 size={20} /> Informazioni Cliente</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Azienda *</label>
                  <input type="text" value={form.nome_azienda || ''} onChange={e => {
                    const val = e.target.value
                    setForm(f => {
                      const upd = { ...f, nome_azienda: val }
                      // Auto-generate slug if slug was empty
                      if (!f.portale_slug) {
                        upd.portale_slug = (val.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                      }
                      return upd
                    })
                  }} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cartella dedicata del portale</label>
                  <input type="text" value={form.portale_slug || ''} onChange={e => setForm(f => ({ ...f, portale_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="es. rossi-srl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referente Commerciale</label>
                  <input type="text" value={form.referente || ''} onChange={e => setForm(f => ({ ...f, referente: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Referente Commerciale *</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">*questa mail non è un account di accesso al sistema</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input type="text" value={form.telefono || ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                  <input type="text" value={form.indirizzo || ''} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))} placeholder="Via/Piazza..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                  <input type="text" value={form.citta || ''} onChange={e => setForm(f => ({ ...f, citta: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <input type="text" value={form.provincia || ''} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} maxLength={2} placeholder="es. MI" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SLA Reazione</label>
                  <select value={form.sla_reazione || 'nb'} onChange={e => setForm(f => ({ ...f, sla_reazione: e.target.value }))} className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500">
                    <option value="nb">NB (nessun vincolo)</option>
                    <option value="1g">1 giorno</option>
                    <option value="3g">3 giorni</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer">
                <Save size={16} /> {saving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Logo */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Logo</h2>
            <div className="flex flex-col items-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-32 h-32 object-contain rounded-lg border border-gray-200 mb-4" />
              ) : (
                <div className="w-32 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                  <Building2 size={40} className="text-gray-300" />
                </div>
              )}
              <div className="flex gap-2">
                <input type="file" ref={fileRef} onChange={handleLogoUpload} accept=".jpg,.jpeg,.png" className="hidden" />
                <button onClick={() => fileRef.current.click()} className="inline-flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer">
                  <Upload size={14} /> Carica
                </button>
                {logoUrl && (
                  <button onClick={handleLogoDelete} className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-100 transition-colors cursor-pointer">
                    <Trash2 size={14} /> Rimuovi
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">JPG o PNG, max 2MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Users Section */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><UserCircle size={20} /> Utenti Portale</h2>
          <button onClick={() => openUserForm()} className="inline-flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
            <Plus size={16} /> Aggiungi Utente
          </button>
        </div>

        {/* User Form (inline) */}
        {showUserForm && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <form onSubmit={handleUserSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input type="text" value={userForm.nome} onChange={e => setUserForm(f => ({ ...f, nome: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser ? '(lascia vuoto per non cambiare)' : '*'}</label>
                  <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} required={!editingUser} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                  <select value={userForm.ruolo} onChange={e => setUserForm(f => ({ ...f, ruolo: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lingua</label>
                  <select value={userForm.lingua} onChange={e => setUserForm(f => ({ ...f, lingua: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="it">Italiano</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                <div className="flex gap-8">
                  {userForm.ruolo === 'user' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Schede Visibili</label>
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={userForm.schede_visibili.includes('ticket')} onChange={() => toggleScheda('ticket')} className="rounded border-gray-300" />
                          Ticket
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={userForm.schede_visibili.includes('progetti')} onChange={() => toggleScheda('progetti')} className="rounded border-gray-300" />
                          Progetti
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={userForm.schede_visibili.includes('ai')} onChange={() => toggleScheda('ai')} className="rounded border-gray-300" />
                          AI Assistant
                        </label>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opzioni Sicurezza</label>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!userForm.cambio_password} onChange={() => setUserForm(f => ({ ...f, cambio_password: f.cambio_password ? 0 : 1 }))} className="rounded border-gray-300" />
                        Consenti cambio password al primo avvio
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!!userForm.two_factor} onChange={() => setUserForm(f => ({ ...f, two_factor: f.two_factor ? 0 : 1 }))} className="rounded border-gray-300" />
                        Utilizza autenticazione a 2 fattori
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
                  {editingUser ? 'Aggiorna' : 'Crea Utente'}
                </button>
                <button type="button" onClick={() => setShowUserForm(false)} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        {users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nessun utente portale configurato</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Ruolo</th>
                  <th className="px-4 py-3 font-medium">Schede</th>
                  <th className="px-4 py-3 font-medium">Lingua</th>
                  <th className="px-4 py-3 font-medium">Creato il</th>
                  <th className="px-4 py-3 font-medium">Attivo</th>
                  <th className="px-4 py-3 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.ruolo === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                        {u.ruolo === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.ruolo === 'admin' ? (
                        <span className="text-xs text-gray-400">Tutte</span>
                      ) : (
                        <div className="flex gap-1">
                          {u.schede_visibili.split(',').map(s => (
                            <span key={s} className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
                              {s === 'ticket' ? 'Ticket' : s === 'progetti' ? 'Progetti' : 'AI'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {u.lingua === 'en' ? '🇬🇧 EN' : u.lingua === 'fr' ? '🇫🇷 FR' : '🇮🇹 IT'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${u.attivo ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${u.attivo ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openUserForm(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referenti Progetti Section */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={20} className="text-indigo-500" /> Anagrafica Referenti Progetti</h2>
          <button onClick={() => openRefForm()} className="inline-flex items-center gap-1 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer">
            <Plus size={16} /> Nuovo Referente
          </button>
        </div>

        {showRefForm && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <form onSubmit={handleRefSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input type="text" value={refForm.nome} onChange={e => setRefForm(f => ({ ...f, nome: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                  <input type="text" value={refForm.cognome} onChange={e => setRefForm(f => ({ ...f, cognome: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={refForm.email} onChange={e => setRefForm(f => ({ ...f, email: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input type="text" value={refForm.telefono} onChange={e => setRefForm(f => ({ ...f, telefono: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo/Posizione</label>
                  <input type="text" value={refForm.ruolo} onChange={e => setRefForm(f => ({ ...f, ruolo: e.target.value }))} placeholder="es. Project Manager, IT Manager..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 cursor-pointer">
                  {editingRef ? 'Aggiorna' : 'Crea Referente'}
                </button>
                <button type="button" onClick={() => { setShowRefForm(false); setEditingRef(null) }} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {referenti.length === 0 && !showRefForm ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nessun referente progetto per questo cliente</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telefono</th>
                  <th className="px-4 py-3 font-medium">Ruolo</th>
                  <th className="px-4 py-3 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referenti.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.nome} {r.cognome}</td>
                    <td className="px-4 py-3 text-gray-600">{r.email}</td>
                    <td className="px-4 py-3 text-gray-600">{r.telefono || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.ruolo || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openRefForm(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteRef(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Knowledge Base Section */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={20} className="text-teal-500" /> Knowledge Base</h2>
          <button onClick={() => openKbForm()} className="inline-flex items-center gap-1 bg-teal-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer">
            <Plus size={16} /> Nuova Scheda
          </button>
        </div>

        {/* KB Form (inline) */}
        {showKbForm && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <form onSubmit={handleKbSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo *</label>
                <input type="text" value={kbForm.titolo} onChange={e => setKbForm(f => ({ ...f, titolo: e.target.value }))} required placeholder="Es: Infrastruttura rete, Credenziali..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenuto *</label>
                <textarea value={kbForm.contenuto} onChange={e => setKbForm(f => ({ ...f, contenuto: e.target.value }))} required rows={6} placeholder="Informazioni dettagliate..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono text-xs" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingKb} className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 cursor-pointer">
                  {savingKb ? 'Salvataggio...' : editingKb ? 'Aggiorna Scheda' : 'Crea Scheda'}
                </button>
                <button type="button" onClick={() => { setShowKbForm(false); setEditingKb(null) }} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* KB List */}
        {kbList.length === 0 && !showKbForm ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nessuna scheda knowledge base per questo cliente</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {kbList.map(kb => (
              <div key={kb.id}>
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <button onClick={() => setExpandedKb(expandedKb === kb.id ? null : kb.id)}
                    className="flex-1 text-left cursor-pointer">
                    <h3 className="text-sm font-medium text-gray-900">{kb.titolo}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Aggiornata: {new Date(kb.updated_at).toLocaleString('it-IT')}
                    </p>
                  </button>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => openKbForm(kb)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteKb(kb.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expandedKb === kb.id && (
                  <div className="px-4 pb-4">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto font-mono">{kb.contenuto}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
