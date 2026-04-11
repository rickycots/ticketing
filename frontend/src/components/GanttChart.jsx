import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const DAY_WIDTH = 13
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 48
const LEFT_WIDTH = 250

const statoBarColors = {
  da_fare: { bg: '#d1d5db', fill: '#9ca3af' },
  in_corso: { bg: '#bfdbfe', fill: '#3b82f6' },
  completata: { bg: '#bbf7d0', fill: '#22c55e' },
  bloccata: { bg: '#fecaca', fill: '#ef4444' },
}

const statoLabels = {
  da_fare: 'Da fare',
  in_corso: 'In corso',
  completata: 'Completata',
  bloccata: 'Bloccata',
}

// --- Date utils ---
function parseDate(s) {
  if (!s) return null
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''))
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function formatMonth(d) {
  return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
}

function formatDateShort(d) {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const RANGE_OPTIONS = [
  { label: '3 mesi', months: 3 },
  { label: '6 mesi', months: 6 },
  { label: '1 anno', months: 12 },
]

function formatDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function GanttChart({ attivita, projectStart, projectEnd, projectId, scheduledActivities = [], onActivityUpdate }) {
  const [tooltip, setTooltip] = useState(null)
  const [rangeMonths, setRangeMonths] = useState(6)
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const navigate = useNavigate()
  const dragRef = useRef(null) // { barId, type: 'move'|'left'|'right', startX, origStart, origEnd, origBarIdx }
  const [dragState, setDragState] = useState(null) // { barId, newStart, newEnd, overBarId }
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = user.ruolo === 'admin'

  const { timelineStart, timelineEnd, months, bars, totalDays } = useMemo(() => {
    if (!attivita || attivita.length === 0) {
      return { timelineStart: new Date(), timelineEnd: new Date(), months: [], bars: [], totalDays: 30 }
    }

    // Compute bar dates for each activity, sorted by start date
    const barsRaw = attivita.map(a => {
      const start = parseDate(a.data_inizio) || parseDate(a.created_at) || new Date()
      const end = parseDate(a.data_scadenza) || addDays(start, 1)
      const actualEnd = end > start ? end : addDays(start, 1)
      return { ...a, barStart: start, barEnd: actualEnd }
    }).sort((a, b) => a.barStart - b.barStart)

    // Timeline range: use rangeMonths filter
    const allStarts = barsRaw.map(b => b.barStart.getTime())
    const pStart = parseDate(projectStart)
    if (pStart) allStarts.push(pStart.getTime())

    const minDate = new Date(Math.min(...allStarts))
    const thisMonth = startOfMonth(new Date())

    // Start: earliest between minDate and current month, but at least current month
    const tStart = minDate < thisMonth ? startOfMonth(minDate) : thisMonth
    // End: tStart + rangeMonths
    const tEnd = new Date(tStart.getFullYear(), tStart.getMonth() + rangeMonths, 1)
    const tDays = daysBetween(tStart, tEnd)

    // Generate months for header
    const monthList = []
    let cur = startOfMonth(tStart)
    while (cur < tEnd) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const dayOffset = daysBetween(tStart, cur)
      const daysInRange = daysBetween(cur, next < tEnd ? next : tEnd)
      monthList.push({ date: new Date(cur), offset: dayOffset, days: daysInRange })
      cur = next
    }

    return { timelineStart: tStart, timelineEnd: tEnd, months: monthList, bars: barsRaw, totalDays: tDays }
  }, [attivita, projectStart, projectEnd, rangeMonths])

  const chartWidth = totalDays * DAY_WIDTH
  const EXTRA_ROWS = 3
  const chartHeight = (bars.length + EXTRA_ROWS) * ROW_HEIGHT

  // "Today" line
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = daysBetween(timelineStart, today)
  const showToday = todayOffset >= 0 && todayOffset <= totalDays

  // Build activity id→index map for dependency arrows
  const idToIndex = useMemo(() => {
    const m = {}
    bars.forEach((b, i) => { m[b.id] = i })
    return m
  }, [bars])

  function handleMouseEnter(e, bar) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      bar,
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 10,
    })
  }

  function handleMouseLeave() {
    if (!dragRef.current) setTooltip(null)
  }

  function getSvgX(e) {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    return e.clientX - rect.left
  }

  function handleDragStart(e, bar, type) {
    if (!isAdmin || !onActivityUpdate) return
    e.stopPropagation()
    e.preventDefault()
    const svgX = getSvgX(e)
    dragRef.current = { barId: bar.id, type, startX: svgX, origStart: new Date(bar.barStart), origEnd: new Date(bar.barEnd), barIdx: bars.findIndex(b => b.id === bar.id) }
    setDragState({ barId: bar.id, newStart: bar.barStart, newEnd: bar.barEnd, overBarId: null })
    setTooltip(null)

    function onMove(ev) {
      const dr = dragRef.current
      if (!dr) return
      const curX = getSvgX(ev)
      const diffDays = Math.round((curX - dr.startX) / DAY_WIDTH)
      let newStart = dr.origStart, newEnd = dr.origEnd

      if (dr.type === 'move') {
        newStart = addDays(dr.origStart, diffDays)
        newEnd = addDays(dr.origEnd, diffDays)
      } else if (dr.type === 'left') {
        newStart = addDays(dr.origStart, diffDays)
        if (newStart >= dr.origEnd) newStart = addDays(dr.origEnd, -1)
      } else if (dr.type === 'right') {
        newEnd = addDays(dr.origEnd, diffDays)
        if (newEnd <= dr.origStart) newEnd = addDays(dr.origStart, 1)
      }

      // Check if hovering over another bar (for dependency)
      let overBarId = null
      if (dr.type === 'move') {
        const myRow = dr.barIdx
        const rowAtY = Math.floor((ev.clientY - svgRef.current.getBoundingClientRect().top) / ROW_HEIGHT)
        if (rowAtY !== myRow && rowAtY >= 0 && rowAtY < bars.length) {
          overBarId = bars[rowAtY].id
        }
      }

      setDragState({ barId: dr.barId, newStart, newEnd, overBarId })
    }

    function onUp() {
      const dr = dragRef.current
      if (dr) {
        const ds = { barId: dr.barId, newStart: null, newEnd: null, overBarId: null }
        // Read latest dragState
        setDragState(prev => {
          if (prev && onActivityUpdate) {
            const updates = {}
            if (dr.type === 'move' && prev.overBarId) {
              // Prevent circular dependency
              const targetBar = bars.find(b => b.id === prev.overBarId)
              if (!targetBar || targetBar.dipende_da === dr.barId) {
                // Skip: would create circular dependency
              } else {
                updates.dipende_da = prev.overBarId
              }
              updates.data_inizio = formatDateISO(prev.newStart)
              updates.data_scadenza = formatDateISO(prev.newEnd)
            } else {
              updates.data_inizio = formatDateISO(prev.newStart)
              updates.data_scadenza = formatDateISO(prev.newEnd)
            }
            onActivityUpdate(dr.barId, updates)
          }
          return null
        })
      }
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (!attivita || attivita.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-8">Nessuna attivita da visualizzare</div>
  }

  const scrollRef = useRef(null)
  useEffect(() => {
    if (scrollRef.current && showToday) {
      const todayX = todayOffset * DAY_WIDTH
      // Scroll so today line is ~50px from left edge
      scrollRef.current.scrollLeft = Math.max(0, todayX - 50)
    }
  }, [timelineStart, todayOffset])

  return (
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
        <div className="ml-auto flex items-center gap-3">
          {[['in_corso', 'In corso'], ['da_fare', 'Da fare'], ['completata', 'Terminata'], ['bloccata', 'Bloccata']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: statoBarColors[key].fill }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex">
        {/* Left panel — activity names */}
        <div className="shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: LEFT_WIDTH }}>
          {/* Header */}
          <div className="flex items-center px-3 font-semibold text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200" style={{ height: HEADER_HEIGHT }}>
            Attivita
          </div>
          {/* Rows */}
          {bars.map((bar, i) => {
            const colors = statoBarColors[bar.stato] || statoBarColors.da_fare
            return (
              <div
                key={bar.id}
                className="flex items-center px-3 gap-2 border-b border-gray-100"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: colors.fill }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {projectId ? (
                    <a
                      href={`/admin/projects/${projectId}/activities/${bar.id}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/admin/projects/${projectId}/activities/${bar.id}`, { state: { from: 'gantt' } }) }}
                      className="block truncate text-gray-700 text-xs font-medium hover:text-blue-600 hover:underline"
                      title={bar.nome}
                    >{bar.nome}</a>
                  ) : (
                    <span className="block truncate text-gray-700 text-xs font-medium" title={bar.nome}>{bar.nome}</span>
                  )}
                  {bar.assegnato_nome && <span className="block truncate text-gray-400 text-xs">{bar.assegnato_nome}</span>}
                </div>
                {bar.stato === 'bloccata' && (
                  <span title="Attività bloccata" className="shrink-0 text-orange-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                  </span>
                )}
              </div>
            )
          })}
          {/* Empty rows for tooltip space */}
          {Array.from({ length: EXTRA_ROWS }).map((_, i) => (
            <div key={`empty-${i}`} className="border-b border-gray-100" style={{ height: ROW_HEIGHT }} />
          ))}
        </div>

        {/* Right panel — scrollable timeline */}
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
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

            {/* Bars area as SVG */}
            <svg ref={svgRef} width={chartWidth} height={chartHeight} className="block">
              {/* Month gridlines */}
              {months.map((m, i) => (
                <line
                  key={`gl-${i}`}
                  x1={m.offset * DAY_WIDTH}
                  y1={0}
                  x2={m.offset * DAY_WIDTH}
                  y2={chartHeight}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}

              {/* Row gridlines */}
              {bars.map((_, i) => (
                <line
                  key={`rl-${i}`}
                  x1={0}
                  y1={(i + 1) * ROW_HEIGHT}
                  x2={chartWidth}
                  y2={(i + 1) * ROW_HEIGHT}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
              ))}

              {/* Dependency arrows */}
              {bars.map(bar => {
                if (!bar.dipende_da || idToIndex[bar.dipende_da] === undefined) return null
                const fromIdx = idToIndex[bar.dipende_da]
                const fromBar = bars[fromIdx]
                const toIdx = idToIndex[bar.id]

                // Arrow: from END of source bar → to START of dependent bar
                const fromX = daysBetween(timelineStart, fromBar.barEnd) * DAY_WIDTH
                const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                const toX = daysBetween(timelineStart, bar.barStart) * DAY_WIDTH
                const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                // Build path: right from source end, down/up to target row, right to target start
                const gap = 10
                let path
                if (toX > fromX + gap) {
                  // Normal case: target starts after source ends
                  const midX = fromX + gap
                  path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`
                } else {
                  // Overlap case: target starts before source ends, route around
                  const midX1 = fromX + gap
                  const detourY = Math.max(fromY, toY) + ROW_HEIGHT * 0.6
                  const midX2 = toX - gap
                  path = `M ${fromX} ${fromY} L ${midX1} ${fromY} L ${midX1} ${detourY} L ${midX2} ${detourY} L ${midX2} ${toY} L ${toX} ${toY}`
                }

                return (
                  <g key={`dep-${bar.id}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="1.5"
                    />
                    {/* Arrowhead */}
                    <polygon
                      points={`${toX},${toY} ${toX - 7},${toY - 4} ${toX - 7},${toY + 4}`}
                      fill="#64748b"
                    />
                  </g>
                )
              })}

              {/* Activity bars */}
              {bars.map((bar, i) => {
                const isDragging = dragState && dragState.barId === bar.id
                const barStart = isDragging ? dragState.newStart : bar.barStart
                const barEnd = isDragging ? dragState.newEnd : bar.barEnd
                const x = daysBetween(timelineStart, barStart) * DAY_WIDTH
                const w = Math.max(daysBetween(barStart, barEnd) * DAY_WIDTH, DAY_WIDTH)
                const y = i * ROW_HEIGHT + 8
                const h = ROW_HEIGHT - 16
                const colors = statoBarColors[bar.stato] || statoBarColors.da_fare
                const fillW = w * (bar.avanzamento / 100)
                const isDropTarget = dragState && dragState.overBarId === bar.id
                const HANDLE_W = 6

                return (
                  <g
                    key={`bar-${bar.id}`}
                    onMouseEnter={(e) => !dragRef.current && handleMouseEnter(e, bar)}
                    onMouseMove={(e) => !dragRef.current && handleMouseEnter(e, bar)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => !dragRef.current && projectId && navigate(`/admin/projects/${projectId}/activities/${bar.id}`, { state: { from: 'gantt' } })}
                    className={isDragging ? '' : 'cursor-pointer'}
                    opacity={isDragging ? 0.7 : 1}
                  >
                    {/* Drop target highlight */}
                    {isDropTarget && (
                      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={6} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,2" />
                    )}
                    {/* Background */}
                    <rect x={x} y={y} width={w} height={h} rx={4} fill={colors.bg} />
                    {/* Progress fill */}
                    {fillW > 0 && (
                      <rect x={x} y={y} width={fillW} height={h} rx={4} fill={colors.fill} opacity={0.8} />
                    )}
                    {/* Border */}
                    <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={isDragging ? '#2563eb' : colors.fill} strokeWidth={isDragging ? 2 : 1} opacity={isDragging ? 1 : 0.5} />
                    {/* Percentage label */}
                    {w > 40 && (
                      <text x={x + 6} y={y + h / 2 + 4} fontSize="10" fill={fillW > 30 ? '#fff' : colors.fill} fontWeight="600">
                        {bar.avanzamento}%
                      </text>
                    )}
                    {/* Drag handles (admin only) */}
                    {isAdmin && onActivityUpdate && !isDragging && (
                      <>
                        {/* Left handle - resize start */}
                        <rect x={x} y={y} width={HANDLE_W} height={h} rx={2} fill="transparent" className="cursor-ew-resize" onMouseDown={(e) => handleDragStart(e, bar, 'left')} />
                        {/* Center handle - move */}
                        <rect x={x + HANDLE_W} y={y} width={Math.max(w - HANDLE_W * 2, 1)} height={h} fill="transparent" className="cursor-grab" onMouseDown={(e) => handleDragStart(e, bar, 'move')} />
                        {/* Right handle - resize end */}
                        <rect x={x + w - HANDLE_W} y={y} width={HANDLE_W} height={h} rx={2} fill="transparent" className="cursor-ew-resize" onMouseDown={(e) => handleDragStart(e, bar, 'right')} />
                      </>
                    )}
                    {/* Scheduled activity dots */}
                    {scheduledActivities.filter(s => s.attivita_id === bar.id).map((s, si) => {
                      const sDate = parseDate(s.data_pianificata)
                      if (!sDate) return null
                      const dotX = daysBetween(timelineStart, sDate) * DAY_WIDTH
                      return (
                        <g key={`sched-${s.id || si}`}>
                          <circle cx={dotX} cy={y + h / 2} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
                        </g>
                      )
                    })}
                  </g>
                )
              })}

              {/* Today line */}
              {showToday && (
                <>
                  <line
                    x1={todayOffset * DAY_WIDTH}
                    y1={0}
                    x2={todayOffset * DAY_WIDTH}
                    y2={chartHeight}
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                  <text
                    x={todayOffset * DAY_WIDTH + 4}
                    y={12}
                    fontSize="10"
                    fill="#ef4444"
                    fontWeight="600"
                  >
                    Oggi
                  </text>
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
          <p>Stato: {statoLabels[tooltip.bar.stato] || tooltip.bar.stato}</p>
          <p>Inizio: {formatDateShort(tooltip.bar.barStart)}</p>
          <p>Fine: {formatDateShort(tooltip.bar.barEnd)}</p>
          {tooltip.bar.assegnato_nome && <p>Assegnato: {tooltip.bar.assegnato_nome}</p>}
          <p>Avanzamento: {tooltip.bar.avanzamento}%</p>
        </div>
      )}
    </div>
  )
}
