import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MessageCircle, Building2 } from 'lucide-react'
import { projects, clients as clientsApi, users } from '../../api/client'
import Pagination from '../../components/Pagination'

const statoColors = {
  attivo: 'bg-green-100 text-green-800',
  in_pausa: 'bg-yellow-100 text-yellow-800',
  completato: 'bg-blue-100 text-blue-800',
  annullato: 'bg-gray-100 text-gray-600',
}

const bloccoLabels = {
  nessuno: null,
  lato_admin: 'In lavorazione',
  lato_cliente: 'In attesa del cliente',
}

const bloccoColors = {
  lato_admin: 'bg-blue-50 text-blue-700 border border-blue-200',
  lato_cliente: 'bg-orange-50 text-orange-700 border border-orange-200',
}

const selectCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

export default function ProjectList() {
  const [projectList, setProjectList] = useState([])
  const [clientList, setClientList] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', nome: '', descrizione: '', data_scadenza: '', tecnici: [] })
  const [activeTab, setActiveTab] = useState('aperti')
  const [filterCliente, setFilterCliente] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 25 })
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function loadProjects() {
    setLoading(true)
    const params = { page }
    if (filterCliente) params.cliente_id = filterCliente
    projects.list(params).then(res => {
      setProjectList(res.data)
      setPagination({ total: res.total, totalPages: res.totalPages, limit: res.limit })
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProjects()
  }, [page, filterCliente])

  useEffect(() => {
    if (isAdmin) {
      clientsApi.list({ limit: 1000 }).then(res => setClientList(res.data || [])).catch(console.error)
      users.list().then(setUserList).catch(console.error)
    }
  }, [])

  const tecnici = userList.filter(u => u.ruolo === 'tecnico' && u.attivo)

  const progettiAperti = projectList.filter(p => p.stato === 'attivo' || p.stato === 'in_pausa')
  const progettiCompletati = projectList.filter(p => p.stato === 'completato' || p.stato === 'annullato')
  const visibleProjects = activeTab === 'aperti' ? progettiAperti : progettiCompletati

  function handleTecnicoToggle(uid) {
    setForm(f => ({
      ...f,
      tecnici: f.tecnici.includes(uid)
        ? f.tecnici.filter(id => id !== uid)
        : [...f.tecnici, uid]
    }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    await projects.create(form)
    setForm({ cliente_id: '', nome: '', descrizione: '', data_scadenza: '', tecnici: [] })
    setShowForm(false)
    loadProjects()
  }

  function getTecniciNames(ids) {
    if (!ids || ids.length === 0) return null
    return ids.map(id => {
      const u = userList.find(u => u.id === id)
      return u ? u.nome.split(' ').map(p => p[0]).join('').toUpperCase() : '?'
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Progetti</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Nuovo Progetto
          </button>
        )}
      </div>

      {/* New Project Form */}
      {showForm && isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome progetto *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                  required
                  className={selectCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  required
                  className={selectCls}
                >
                  <option value="">Seleziona cliente...</option>
                  {clientList.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_azienda}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine Prevista</label>
                <input
                  type="date"
                  value={form.data_scadenza}
                  onChange={(e) => setForm(f => ({ ...f, data_scadenza: e.target.value }))}
                  className={selectCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <textarea
                value={form.descrizione}
                onChange={(e) => setForm(f => ({ ...f, descrizione: e.target.value }))}
                placeholder="Descrizione del progetto (opzionale)"
                rows={2}
                className={selectCls + " resize-y"}
              />
            </div>
            {tecnici.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visibilità (tecnici)</label>
                <div className="flex flex-wrap gap-2">
                  {tecnici.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleTecnicoToggle(u.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                        form.tecnici.includes(u.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {u.nome}
                    </button>
                  ))}
                </div>
                {form.tecnici.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Nessun tecnico selezionato — il progetto sara' visibile solo all'admin</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
                Crea Progetto
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 cursor-pointer">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs + Filter */}
      <div className="flex items-end justify-between mb-4 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('aperti')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'aperti'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Aperti <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'aperti' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{progettiAperti.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('completati')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'completati'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Completati <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'completati' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{progettiCompletati.length}</span>
          </button>
        </div>
        {isAdmin && clientList.length > 0 && (
          <div className="pb-2">
            <select
              value={filterCliente}
              onChange={(e) => { setFilterCliente(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tutti i clienti</option>
              {clientList.map(c => (
                <option key={c.id} value={c.id}>{c.nome_azienda}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Client filter banner */}
      {filterCliente && (() => {
        const cl = clientList.find(c => String(c.id) === String(filterCliente))
        return cl ? (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-teal-600" />
            </div>
            <span className="text-sm font-bold text-teal-900">{cl.nome_azienda}</span>
          </div>
        ) : null
      })()}

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : visibleProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {activeTab === 'aperti' ? 'Nessun progetto aperto' : 'Nessun progetto completato'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map(p => (
            <Link
              key={p.id}
              to={`/admin/projects/${p.id}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{p.nome}</h3>
                  {p.chat_non_lette > 0 && (
                    <span className="relative inline-flex items-center" title={`${p.chat_non_lette} messaggi non letti`}>
                      <MessageCircle size={16} className="text-blue-500" />
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {p.chat_non_lette}
                      </span>
                    </span>
                  )}
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[p.stato]}`}>
                  {p.stato.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-3">{p.cliente_nome}</p>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Avanzamento</span>
                  <span>{p.avanzamento}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${p.avanzamento}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                <span>{p.num_attivita} attività</span>
                {p.data_scadenza && (
                  <span>Fine: {new Date(p.data_scadenza).toLocaleDateString('it-IT')}</span>
                )}
              </div>

              {/* Tecnici avatars */}
              {isAdmin && p.tecnici && p.tecnici.length > 0 && (
                <div className="flex gap-1 mt-3">
                  {getTecniciNames(p.tecnici)?.map((initials, i) => (
                    <span key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {initials}
                    </span>
                  ))}
                </div>
              )}

              {bloccoLabels[p.blocco] && (
                <div className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-medium ${bloccoColors[p.blocco]}`}>
                  {p.blocco === 'lato_cliente' ? '⚠️ ' : '🔧 '}{bloccoLabels[p.blocco]}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
