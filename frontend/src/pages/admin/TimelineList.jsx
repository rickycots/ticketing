import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Building2, Plus, X, Users, UserPlus } from 'lucide-react'
import { projects, clients as clientsApi, users as usersApi } from '../../api/client'

const DAY_WIDTH = 13
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 48
const LEFT_WIDTH = 250

const statoBarColors = {
  attivo: { bg: '#bfdbfe', fill: '#3b82f6' },
  in_pausa: { bg: '#fef08a', fill: '#eab308' },
  completato: { bg: '#bbf7d0', fill: '#22c55e' },
  annullato: { bg: '#d1d5db', fill: '#9ca3af' },
}

const RANGE_OPTIONS = [
  { label: '3 mesi', months: 3 },
  { label: '6 mesi', months: 6 },
  { label: '1 anno', months: 12 },
]

function parseDate(s) {
  if (!s) return null
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''))
  return isNaN(d.getTime()) ? null : d
}
function daysBetween(a, b) { return Math.round((b - a) / 86400000) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function formatMonth(d) { return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }) }
function formatDateShort(d) { return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

export default function TimelineList() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [rangeMonths, setRangeMonths] = useState(6)
  const [tooltip, setTooltip] = useState(null)
  const [clientList, setClientList] = useState([])
  const [filterCliente, setFilterCliente] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [userList, setUserList] = useState([])
  const [newProject, setNewProject] = useState({ cliente_id: '', nome: '', descrizione: '', data_inizio: '', data_scadenza: '', tecnici: [], referenti: [], nuovi_referenti: [] })
  const [creating, setCreating] = useState(false)
  const [clientReferenti, setClientReferenti] = useState([])
  const [showNewRef, setShowNewRef] = useState(false)
  const [newRefForm, setNewRefForm] = useState({ nome: '', cognome: '', email: '' })
  const [manutenzioneOrdinaria, setManutenzioneOrdinaria] = useState(false)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function loadProjects() {
    const params = { limit: 200 }
    if (filterCliente) params.cliente_id = filterCliente
    setLoading(true)
    projects.list(params)
      .then(res => setList(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProjects()
  }, [filterCliente])

  useEffect(() => {
    if (isAdmin) {
      clientsApi.list({ limit: 1000 }).then(res => setClientList(res.data || [])).catch(() => {})
      usersApi.list().then(setUserList).catch(() => {})
    }
  }, [])

  // Load referenti when client changes in new project form
  useEffect(() => {
    setClientReferenti([])
    if (newProject.cliente_id) {
      clientsApi.getReferenti(newProject.cliente_id)
        .then(data => setClientReferenti(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [newProject.cliente_id])

  const { timelineStart, months, bars, totalDays } = useMemo(() => {
    if (!list || list.length === 0) {
      return { timelineStart: new Date(), months: [], bars: [], totalDays: 30 }
    }

    const barsRaw = list.map(p => {
      const start = parseDate(p.data_inizio) || parseDate(p.created_at) || new Date()
      const end = parseDate(p.data_scadenza) || addDays(start, 30)
      const actualEnd = end > start ? end : addDays(start, 30)
      return { ...p, barStart: start, barEnd: actualEnd }
    })

    const allStarts = barsRaw.map(b => b.barStart.getTime())
    const minDate = new Date(Math.min(...allStarts))
    const tStart = startOfMonth(addDays(minDate, -7))
    const tEnd = new Date(tStart.getFullYear(), tStart.getMonth() + rangeMonths, 1)
    const tDays = daysBetween(tStart, tEnd)

    const monthList = []
    let cur = startOfMonth(tStart)
    while (cur < tEnd) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const dayOffset = daysBetween(tStart, cur)
      const daysInRange = daysBetween(cur, next < tEnd ? next : tEnd)
      monthList.push({ date: new Date(cur), offset: dayOffset, days: daysInRange })
      cur = next
    }

    return { timelineStart: tStart, months: monthList, bars: barsRaw, totalDays: tDays }
  }, [list, rangeMonths])

  // Group by client when no filter is active
  const SEP_HEIGHT = ROW_HEIGHT / 2
  const grouped = useMemo(() => {
    if (filterCliente || bars.length === 0) {
      return {
        rows: bars.map((bar, i) => ({ type: 'bar', bar, y: i * ROW_HEIGHT, height: ROW_HEIGHT })),
        totalHeight: bars.length * ROW_HEIGHT
      }
    }
    const sorted = [...bars].sort((a, b) => (a.cliente_nome || '').localeCompare(b.cliente_nome || ''))
    const rows = []
    let y = 0
    let lastClienteId = null
    for (const bar of sorted) {
      if (bar.cliente_id !== lastClienteId) {
        // Half-height separator (also before first group as header)
        rows.push({ type: 'separator', y, height: SEP_HEIGHT, cliente_nome: bar.cliente_nome })
        y += SEP_HEIGHT
        lastClienteId = bar.cliente_id
      }
      rows.push({ type: 'bar', bar, y, height: ROW_HEIGHT })
      y += ROW_HEIGHT
    }
    return { rows, totalHeight: y, sorted }
  }, [bars, filterCliente])

  const EXTRA_ROWS = 3
  const chartWidth = totalDays * DAY_WIDTH
  const chartHeight = grouped.totalHeight + EXTRA_ROWS * ROW_HEIGHT

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = daysBetween(timelineStart, today)
  const showToday = todayOffset >= 0 && todayOffset <= totalDays

  function handleMouseEnter(e, bar) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      bar,
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 10,
    })
  }
  function handleMouseLeave() { setTooltip(null) }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold">Timeline Progetti</h1>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && clientList.length > 0 && (
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tutti i clienti</option>
              {clientList.map(c => (
                <option key={c.id} value={c.id}>{c.nome_azienda}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowNewProject(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={16} /> Nuovo Progetto
            </button>
          )}
        </div>
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

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Nessun progetto</p>
      ) : (
        <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-white" ref={containerRef}>
          {/* Range filter */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
            <span className="text-xs font-medium text-gray-500">Periodo:</span>
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.months}
                onClick={() => setRangeMonths(opt.months)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  rangeMonths === opt.months
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex">
            {/* Left panel — project names */}
            <div className="shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: LEFT_WIDTH }}>
              <div className="flex items-center px-3 font-semibold text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200" style={{ height: HEADER_HEIGHT }}>
                Progetto
              </div>
              {grouped.rows.map((row, i) => {
                if (row.type === 'separator') {
                  return (
                    <div
                      key={`sep-${i}`}
                      className="flex items-center px-3 gap-2 bg-gray-100 border-b border-gray-200"
                      style={{ height: row.height }}
                    >
                      <Building2 size={11} className="text-gray-400 shrink-0" />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">{row.cliente_nome}</span>
                    </div>
                  )
                }
                const bar = row.bar
                const colors = statoBarColors[bar.stato] || statoBarColors.attivo
                return (
                  <div
                    key={bar.id}
                    className="flex items-center px-3 gap-2 border-b border-gray-100 text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => navigate(`/admin/projects/${bar.id}/gantt`)}
                    title="Apri Gantt attività"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors.fill }} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-gray-700 text-xs font-medium">{bar.nome}</span>
                      {filterCliente && <span className="block truncate text-gray-400 text-xs">{bar.cliente_nome}</span>}
                    </div>
                  </div>
                )
              })}
              {Array.from({ length: EXTRA_ROWS }).map((_, i) => (
                <div key={`empty-${i}`} className="border-b border-gray-100" style={{ height: ROW_HEIGHT }} />
              ))}
            </div>

            {/* Right panel — scrollable timeline */}
            <div className="flex-1 overflow-x-auto">
              <div style={{ width: chartWidth, minWidth: '100%' }}>
                {/* Month header */}
                <div className="flex border-b border-gray-200 bg-gray-50" style={{ height: HEADER_HEIGHT }}>
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center text-xs font-medium text-gray-500 border-r border-gray-200 capitalize"
                      style={{ width: m.days * DAY_WIDTH, minWidth: m.days * DAY_WIDTH }}
                    >
                      {formatMonth(m.date)}
                    </div>
                  ))}
                </div>

                {/* SVG bars */}
                <svg width={chartWidth} height={chartHeight} className="block">
                  {/* Month gridlines */}
                  {months.map((m, i) => (
                    <line key={`gl-${i}`} x1={m.offset * DAY_WIDTH} y1={0} x2={m.offset * DAY_WIDTH} y2={chartHeight} stroke="#e5e7eb" strokeWidth="1" />
                  ))}
                  {/* Row gridlines + separator backgrounds */}
                  {grouped.rows.map((row, i) => {
                    if (row.type === 'separator') {
                      return <rect key={`sep-${i}`} x={0} y={row.y} width={chartWidth} height={row.height} fill="#f3f4f6" />
                    }
                    return <line key={`rl-${i}`} x1={0} y1={row.y + row.height} x2={chartWidth} y2={row.y + row.height} stroke="#f3f4f6" strokeWidth="1" />
                  })}

                  {/* Project bars */}
                  {grouped.rows.filter(r => r.type === 'bar').map(row => {
                    const bar = row.bar
                    const x = daysBetween(timelineStart, bar.barStart) * DAY_WIDTH
                    const w = Math.max(daysBetween(bar.barStart, bar.barEnd) * DAY_WIDTH, DAY_WIDTH)
                    const y = row.y + 8
                    const h = ROW_HEIGHT - 16
                    const colors = statoBarColors[bar.stato] || statoBarColors.attivo
                    const fillW = w * (bar.avanzamento / 100)

                    return (
                      <g
                        key={`bar-${bar.id}`}
                        onMouseEnter={(e) => handleMouseEnter(e, bar)}
                        onMouseMove={(e) => handleMouseEnter(e, bar)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => navigate(`/admin/projects/${bar.id}/gantt`)}
                        className="cursor-pointer"
                      >
                        <rect x={x} y={y} width={w} height={h} rx={4} fill={colors.bg} />
                        {fillW > 0 && (
                          <rect x={x} y={y} width={fillW} height={h} rx={4} fill={colors.fill} opacity={0.8} />
                        )}
                        <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={colors.fill} strokeWidth={1} opacity={0.5} />
                        {/* Percentage label */}
                        {w > 40 && (
                          <text x={x + 6} y={y + h / 2 + 4} fontSize="10" fill={fillW > 30 ? '#fff' : colors.fill} fontWeight="600">
                            {bar.avanzamento}%
                          </text>
                        )}
                      </g>
                    )
                  })}

                  {/* Today line */}
                  {showToday && (
                    <>
                      <line x1={todayOffset * DAY_WIDTH} y1={0} x2={todayOffset * DAY_WIDTH} y2={chartHeight} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 3" />
                      <text x={todayOffset * DAY_WIDTH + 4} y={12} fontSize="10" fill="#ef4444" fontWeight="600">Oggi</text>
                    </>
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-50 bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <p className="font-semibold mb-1">{tooltip.bar.nome}</p>
              <p>Cliente: {tooltip.bar.cliente_nome}</p>
              <p>Stato: {tooltip.bar.stato.replace('_', ' ')}</p>
              <p>Inizio: {formatDateShort(tooltip.bar.barStart)}</p>
              <p>Fine: {formatDateShort(tooltip.bar.barEnd)}</p>
              <p>Avanzamento: {tooltip.bar.avanzamento}%</p>
              <p className="mt-1 text-gray-400">Click per aprire Gantt</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Nuovo Progetto */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewProject(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold">Nuovo Progetto</h2>
              <button onClick={() => setShowNewProject(false)} className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!newProject.cliente_id || !newProject.nome.trim()) return
              const hasReferenti = newProject.referenti.length > 0 || newProject.nuovi_referenti.length > 0
              if (!manutenzioneOrdinaria && !hasReferenti) {
                alert('Seleziona almeno un referente, oppure spunta "STM Manutenzione Ordinaria".')
                return
              }
              setCreating(true)
              try {
                await projects.create({
                  ...newProject,
                  cliente_id: Number(newProject.cliente_id),
                  tecnici: newProject.tecnici,
                  referenti: newProject.referenti,
                  nuovi_referenti: newProject.nuovi_referenti,
                  manutenzione_ordinaria: manutenzioneOrdinaria,
                })
                setNewProject({ cliente_id: '', nome: '', descrizione: '', data_inizio: '', data_scadenza: '', tecnici: [], referenti: [], nuovi_referenti: [] })
                setClientReferenti([])
                setShowNewRef(false)
                setManutenzioneOrdinaria(false)
                setShowNewProject(false)
                loadProjects()
              } catch (err) { alert(err.message) }
              finally { setCreating(false) }
            }} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select
                  value={newProject.cliente_id}
                  onChange={(e) => setNewProject(p => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleziona cliente...</option>
                  {clientList.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_azienda}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Progetto *</label>
                <input
                  type="text"
                  value={newProject.nome}
                  onChange={(e) => setNewProject(p => ({ ...p, nome: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nome del progetto"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea
                  value={newProject.descrizione}
                  onChange={(e) => setNewProject(p => ({ ...p, descrizione: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Descrizione opzionale..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                  <input
                    type="date"
                    value={newProject.data_inizio}
                    onChange={(e) => setNewProject(p => ({ ...p, data_inizio: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                  <input
                    type="date"
                    value={newProject.data_scadenza}
                    onChange={(e) => setNewProject(p => ({ ...p, data_scadenza: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tecnici Assegnati</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {userList.filter(u => u.ruolo === 'tecnico' && u.attivo).map(u => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={newProject.tecnici.includes(u.id)}
                        onChange={(e) => {
                          setNewProject(p => ({
                            ...p,
                            tecnici: e.target.checked
                              ? [...p.tecnici, u.id]
                              : p.tecnici.filter(id => id !== u.id)
                          }))
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{u.nome}</span>
                    </label>
                  ))}
                  {userList.filter(u => u.ruolo === 'tecnico' && u.attivo).length === 0 && (
                    <p className="text-xs text-gray-400">Nessun tecnico disponibile</p>
                  )}
                </div>
              </div>
              {/* Manutenzione Ordinaria checkbox */}
              {newProject.cliente_id && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manutenzioneOrdinaria}
                    onChange={e => setManutenzioneOrdinaria(e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">STM Manutenzione Ordinaria</span>
                  <span className="text-xs text-gray-400">(referenti opzionali)</span>
                </label>
              )}

              {/* Referenti progetto */}
              {newProject.cliente_id && (
                <div className={`bg-teal-50 border rounded-lg p-3 ${!manutenzioneOrdinaria && newProject.referenti.length === 0 && newProject.nuovi_referenti.length === 0 ? 'border-red-300' : 'border-teal-200'}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Users size={16} /> Referenti Progetto {!manutenzioneOrdinaria && <span className="text-red-500">*</span>}
                  </label>

                  {clientReferenti.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {clientReferenti.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setNewProject(p => ({
                            ...p,
                            referenti: p.referenti.includes(r.id)
                              ? p.referenti.filter(id => id !== r.id)
                              : [...p.referenti, r.id]
                          }))}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                            newProject.referenti.includes(r.id)
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {r.nome} {r.cognome}
                          <span className="text-xs opacity-75 ml-1">({r.email})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {newProject.nuovi_referenti.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newProject.nuovi_referenti.map((nr, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 px-3 py-1.5 rounded-lg text-sm">
                          {nr.nome} {nr.cognome} ({nr.email})
                          <button type="button" onClick={() => setNewProject(p => ({ ...p, nuovi_referenti: p.nuovi_referenti.filter((_, i) => i !== idx) }))} className="ml-1 hover:text-red-600 cursor-pointer">
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {showNewRef ? (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" placeholder="Nome *" value={newRefForm.nome} onChange={e => setNewRefForm(f => ({ ...f, nome: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="text" placeholder="Cognome" value={newRefForm.cognome} onChange={e => setNewRefForm(f => ({ ...f, cognome: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="email" placeholder="Email *" value={newRefForm.email} onChange={e => setNewRefForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => {
                          if (!newRefForm.nome.trim() || !newRefForm.email.trim()) return
                          setNewProject(p => ({ ...p, nuovi_referenti: [...p.nuovi_referenti, { ...newRefForm }] }))
                          setNewRefForm({ nome: '', cognome: '', email: '' })
                          setShowNewRef(false)
                        }} className="bg-teal-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-teal-700 cursor-pointer">
                          Aggiungi
                        </button>
                        <button type="button" onClick={() => setShowNewRef(false)} className="bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-200 cursor-pointer">
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowNewRef(true)}
                      className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 cursor-pointer mt-1">
                      <UserPlus size={14} /> Nuovo referente
                    </button>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProject.cliente_id || !newProject.nome.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Plus size={16} /> {creating ? 'Creazione...' : 'Crea Progetto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
