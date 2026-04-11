import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { activities } from '../../api/client'

export default function AllActivities() {
  const [allActivities, setAllActivities] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState('cliente_nome')
  const [sortDir, setSortDir] = useState('asc')
  const [filterCliente, setFilterCliente] = useState('')
  const [filterTecnico, setFilterTecnico] = useState(null)
  const [filterAperte, setFilterAperte] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isTecnico = currentUser.ruolo === 'tecnico'
  const PAGE_SIZE = 7

  useEffect(() => {
    setLoading(true)
    activities.listAll().then(acts => {
      const actMap = {}
      acts.forEach(a => { actMap[a.id] = a })

      function countOpenPredecessors(act, visited = new Set()) {
        if (!act.dipende_da || visited.has(act.id)) return 0
        visited.add(act.id)
        const parent = actMap[act.dipende_da]
        if (!parent) return 0
        if (parent.stato === 'completata') return 0
        return 1 + countOpenPredecessors(parent, visited)
      }

      acts.forEach(a => {
        a.ordine_calcolato = countOpenPredecessors(a) + 1
      })

      // Build user list from activity data
      const uMap = new Map()
      acts.forEach(a => {
        if (a.assegnato_a && a.assegnato_nome) uMap.set(a.assegnato_a, { id: a.assegnato_a, nome: a.assegnato_nome })
      })
      setUserList([...uMap.values()])
      setAllActivities(acts)
      // Tecnico default: filter by self + solo aperte
      if (isTecnico && !initialized) {
        setFilterTecnico(Number(currentUser.id))
        setFilterAperte(true)
      }
      setInitialized(true)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  // Unique clients for filter
  const clienti = [...new Map(allActivities.filter(a => a.cliente_nome).map(a => [a.cliente_nome, a.cliente_nome])).values()].sort()

  // Filter
  let filtered = allActivities
  if (filterCliente) filtered = filtered.filter(a => a.cliente_nome === filterCliente)
  if (filterTecnico) filtered = filtered.filter(a => Number(a.assegnato_a) === filterTecnico)
  if (filterAperte) filtered = filtered.filter(a => a.stato !== 'completata')

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const va = a[sortCol], vb = b[sortCol]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    const cmp = typeof va === 'number' ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir
    // Secondary sort by ordine_calcolato when sorting by progetto_nome
    if (cmp === 0 || sortCol === 'progetto_nome') {
      if (cmp !== 0) return cmp
      return (a.ordine_calcolato || 0) - (b.ordine_calcolato || 0)
    }
    return cmp
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  const SortTh = ({ col, children, className = '' }) => (
    <th className={`px-4 py-3 cursor-pointer hover:text-gray-700 transition-colors select-none ${className}`}
      onClick={() => handleSort(col)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={10} className="text-gray-300" />}
      </span>
    </th>
  )

  function getUserInitials(userId) {
    if (!userId) return null
    const u = userList.find(u => Number(u.id) === Number(userId))
    if (!u) return null
    return { nome: u.nome, initials: u.nome.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Elenco Attività</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={() => { setFilterAperte(true); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filterAperte ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              Solo Aperte
            </button>
            <button onClick={() => { setFilterAperte(false); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!filterAperte ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              Tutte
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {userList.map(u => (
              <button key={u.id} onClick={() => { setFilterTecnico(filterTecnico === u.id ? null : u.id); setPage(1) }}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold cursor-pointer transition-all ${
                  filterTecnico === u.id
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 scale-110'
                    : 'bg-blue-100 text-blue-700 hover:scale-105'
                }`}
                title={u.nome}
              >
                {u.nome.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
              </button>
            ))}
            {filterTecnico && (
              <button onClick={() => { setFilterTecnico(null); setPage(1) }} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer ml-1">tutti</button>
            )}
          </div>
          <select value={filterCliente} onChange={e => { setFilterCliente(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Tutte le aziende</option>
            {clienti.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nessuna attività</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <SortTh col="cliente_nome">Azienda</SortTh>
                <SortTh col="progetto_nome">Titolo <span className="normal-case italic font-normal text-gray-400">Ordina per progetto</span></SortTh>
                <SortTh col="ordine_calcolato" className="text-center">Ordine</SortTh>
                <SortTh col="data_scadenza">Fine prevista</SortTh>
                <th className="px-4 py-3 text-center">Tecnico</th>
                <SortTh col="avanzamento" className="text-right">Avanzamento</SortTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map(a => {
                const tecnico = getUserInitials(a.assegnato_a)
                return (
                <tr key={`${a.progetto_id}-${a.id}`} className={`hover:bg-gray-50 transition-colors ${a.stato === 'completata' ? 'bg-green-50/50' : ''}`}>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{a.cliente_nome || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/projects/${a.progetto_id}/activities/${a.id}`} state={{ from: 'all-activities' }} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                      {a.nome}
                    </Link>
                    <p className="text-xs text-gray-400">{a.progetto_nome}</p>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                      a.ordine_calcolato === 1 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {a.ordine_calcolato}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                    {a.data_scadenza ? new Date(a.data_scadenza).toLocaleDateString('it-IT') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {tecnico ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold" title={tecnico.nome}>
                        {tecnico.initials}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${a.avanzamento === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${a.avanzamento}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-8 text-right">{a.avanzamento}%</span>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {sorted.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Mostra <span className="font-medium">{Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}</span>-<span className="font-medium">{Math.min(page * PAGE_SIZE, sorted.length)}</span> di <span className="font-medium">{sorted.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronLeft size={16} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded-lg text-sm font-medium cursor-pointer ${p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
