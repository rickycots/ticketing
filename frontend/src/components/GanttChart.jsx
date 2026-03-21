import { useState, useMemo, useRef } from 'react'
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

export default function GanttChart({ attivita, projectStart, projectEnd, projectId, scheduledActivities = [] }) {
  const [tooltip, setTooltip] = useState(null)
  const [rangeMonths, setRangeMonths] = useState(6)
  const containerRef = useRef(null)
  const navigate = useNavigate()

  const { timelineStart, timelineEnd, months, bars, totalDays } = useMemo(() => {
    if (!attivita || attivita.length === 0) {
      return { timelineStart: new Date(), timelineEnd: new Date(), months: [], bars: [], totalDays: 30 }
    }

    // Compute bar dates for each activity
    const barsRaw = attivita.map(a => {
      const start = parseDate(a.data_inizio) || parseDate(a.created_at) || new Date()
      const end = parseDate(a.data_scadenza) || addDays(start, 1)
      const actualEnd = end > start ? end : addDays(start, 1)
      return { ...a, barStart: start, barEnd: actualEnd }
    })

    // Timeline range: use rangeMonths filter
    const allStarts = barsRaw.map(b => b.barStart.getTime())
    const pStart = parseDate(projectStart)
    if (pStart) allStarts.push(pStart.getTime())

    const minDate = new Date(Math.min(...allStarts))

    // Start: beginning of the month of earliest date
    const tStart = startOfMonth(addDays(minDate, -7))
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
    setTooltip(null)
  }

  if (!attivita || attivita.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-8">Nessuna attivita da visualizzare</div>
  }

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
                {(() => {
                  const sorted = [...bars].sort((a, b) => a.barStart - b.barStart)
                  const idx = sorted.findIndex(b => b.id === bar.id)
                  return (
                    <span className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: colors.fill }}>
                      {idx + 1}
                    </span>
                  )
                })()}
                <div className="min-w-0 flex-1">
                  {projectId ? (
                    <a
                      href={`/admin/projects/${projectId}/activities/${bar.id}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/admin/projects/${projectId}/activities/${bar.id}`) }}
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

            {/* Bars area as SVG */}
            <svg width={chartWidth} height={chartHeight} className="block">
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

                const fromX = daysBetween(timelineStart, fromBar.barEnd) * DAY_WIDTH
                const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                const toX = daysBetween(timelineStart, bar.barStart) * DAY_WIDTH
                const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                const midX = Math.max(fromX + 8, toX - 12)

                return (
                  <g key={`dep-${bar.id}`}>
                    <path
                      d={`M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    {/* Arrowhead */}
                    <polygon
                      points={`${toX},${toY} ${toX - 6},${toY - 4} ${toX - 6},${toY + 4}`}
                      fill="#94a3b8"
                    />
                  </g>
                )
              })}

              {/* Activity bars */}
              {bars.map((bar, i) => {
                const x = daysBetween(timelineStart, bar.barStart) * DAY_WIDTH
                const w = Math.max(daysBetween(bar.barStart, bar.barEnd) * DAY_WIDTH, DAY_WIDTH)
                const y = i * ROW_HEIGHT + 8
                const h = ROW_HEIGHT - 16
                const colors = statoBarColors[bar.stato] || statoBarColors.da_fare
                const fillW = w * (bar.avanzamento / 100)

                return (
                  <g
                    key={`bar-${bar.id}`}
                    onMouseEnter={(e) => handleMouseEnter(e, bar)}
                    onMouseMove={(e) => handleMouseEnter(e, bar)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => projectId && navigate(`/admin/projects/${projectId}/activities/${bar.id}`)}
                    className="cursor-pointer"
                  >
                    {/* Background */}
                    <rect x={x} y={y} width={w} height={h} rx={4} fill={colors.bg} />
                    {/* Progress fill */}
                    {fillW > 0 && (
                      <rect x={x} y={y} width={fillW} height={h} rx={4} fill={colors.fill} opacity={0.8} />
                    )}
                    {/* Border */}
                    <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={colors.fill} strokeWidth={1} opacity={0.5} />
                    {/* Percentage label */}
                    {w > 40 && (
                      <text x={x + 6} y={y + h / 2 + 4} fontSize="10" fill={fillW > 30 ? '#fff' : colors.fill} fontWeight="600">
                        {bar.avanzamento}%
                      </text>
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
