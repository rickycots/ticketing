import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, FolderKanban, Mail, Clock, Users, Calendar, ChevronDown, ChevronRight, ChevronLeft, X, AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react'
import { dashboard } from '../../api/client'
import { APP_VERSION } from '../../version'
import HelpTip from '../../components/HelpTip'

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow h-full">
      <div className="flex items-center justify-between h-full">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub ? <p className="text-xs text-gray-400 mt-1">{sub}</p> : <p className="text-xs text-gray-400 mt-1">&nbsp;</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(true)
  const [showCarico, setShowCarico] = useState(true)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(null)
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    dashboard.get().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (!data) return null

  const scheduledDates = new Set((data.attivita_programmate || []).map(s => s.data_pianificata))
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Calendar helpers
  const firstDay = new Date(calYear, calMonth, 1)
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function prevMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1); setSelectedDay(null) }
  function nextMonth() { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1); setSelectedDay(null) }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">Dashboard <HelpTip text="Panoramica generale: ticket aperti, progetti attivi, email da leggere e clienti. Il calendario mostra le attività programmate (pallini rossi). Clicca sulle card per navigare alla sezione corrispondente." /></h1>

      {/* Stats Grid */}
      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Ticket} label="Ticket Aperti" value={data.ticket_aperti} color="bg-blue-500" to="/admin/tickets" />
          <StatCard icon={FolderKanban} label="Progetti Attivi" value={data.progetti_attivi} sub={`${data.progetti_blocco_cliente} bloccati lato cliente`} color="bg-purple-500" to="/admin/projects" />
          <StatCard icon={Mail} label="Email Non Lette" value={data.email_non_lette} color="bg-green-500" to="/admin/emails" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Ticket} label="Ticket Aperti" value={data.ticket_aperti} color="bg-blue-500" to="/admin/tickets" />
            <StatCard icon={CheckCircle2} label="Ticket Chiusi" value={data.ticket_chiusi || 0} color="bg-gray-400" />
            <StatCard icon={ListChecks} label="Attività Aperte" value={data.attivita_aperte || 0} color="bg-orange-500" to="/admin/all-activities" />
            <StatCard icon={CheckCircle2} label="Attività Chiuse" value={data.attivita_chiuse || 0} color="bg-green-500" />
          </div>

          {/* Scadenze Tecnico */}
          {data.scadenze_tecnico && data.scadenze_tecnico.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="text-lg font-semibold">Scadenze da rispettare</h2>
                <span className="bg-red-100 text-red-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{data.scadenze_tecnico.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {data.scadenze_tecnico.map((s, i) => {
                  const scadenza = new Date(s.data_scadenza)
                  const oggi = new Date()
                  oggi.setHours(0,0,0,0)
                  scadenza.setHours(0,0,0,0)
                  const diffDays = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24))
                  const urgencyColor = diffDays < 0 ? 'bg-red-50 border-l-4 border-l-red-500'
                    : diffDays === 0 ? 'bg-red-50 border-l-4 border-l-red-400'
                    : diffDays <= 3 ? 'bg-orange-50 border-l-4 border-l-orange-400'
                    : diffDays <= 7 ? 'bg-yellow-50 border-l-4 border-l-yellow-400'
                    : 'border-l-4 border-l-gray-200'
                  const urgencyText = diffDays < 0 ? `SCADUTA da ${Math.abs(diffDays)}g`
                    : diffDays === 0 ? 'OGGI'
                    : diffDays === 1 ? 'DOMANI'
                    : `tra ${diffDays}g`
                  const urgencyTextColor = diffDays < 0 ? 'text-red-700 font-bold'
                    : diffDays === 0 ? 'text-red-600 font-bold'
                    : diffDays <= 3 ? 'text-orange-600 font-semibold'
                    : diffDays <= 7 ? 'text-yellow-700'
                    : 'text-gray-500'
                  const isTicket = s.tipo_scadenza === 'ticket'
                  const linkTo = isTicket ? `/admin/tickets/${s.id}` : `/admin/projects/${s.progetto_id}/activities/${s.id}`

                  return (
                    <Link key={`${s.tipo_scadenza}-${s.id}-${i}`} to={linkTo} className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${urgencyColor}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        {isTicket ? <Ticket size={14} className="text-blue-500 shrink-0" /> : <ListChecks size={14} className="text-orange-500 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.nome}</p>
                          <p className="text-xs text-gray-400">{s.cliente_nome}{s.progetto_nome ? ` · ${s.progetto_nome}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-500">{scadenza.toLocaleDateString('it-IT')}</span>
                        <span className={`text-xs ${urgencyTextColor}`}>{urgencyText}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar with scheduled activities */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button onClick={() => setShowCalendar(!showCalendar)} className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-red-500" />
              <h2 className="text-lg font-semibold">Attività Programmate</h2>
              {(data.attivita_programmate || []).length > 0 && <span className="bg-red-100 text-red-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{data.attivita_programmate.length}</span>}
            </div>
            {showCalendar ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          </button>
          {showCalendar && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"><ChevronLeft size={16} className="text-gray-500" /></button>
                <span className="text-sm font-semibold text-gray-700">{MONTHS[calMonth]} {calYear}</span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"><ChevronRight size={16} className="text-gray-500" /></button>
              </div>
              {/* Day names */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {DAYS.map((d, i) => <div key={i} className="text-xs font-semibold text-gray-400 py-1">{d}</div>)}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const hasEvent = scheduledDates.has(dateStr)
                  const isToday = dateStr === todayStr
                  const isSelected = selectedDay === dateStr
                  return (
                    <button
                      key={i}
                      onClick={() => hasEvent ? setSelectedDay(isSelected ? null : dateStr) : null}
                      className={`relative py-2 rounded-lg text-sm transition-colors ${
                        isSelected ? 'bg-red-500 text-white font-bold' :
                        isToday ? 'bg-blue-100 text-blue-800 font-bold' :
                        hasEvent ? 'hover:bg-red-50 cursor-pointer font-medium' :
                        'text-gray-600'
                      } ${hasEvent ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {day}
                      {hasEvent && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                    </button>
                  )
                })}
              </div>

              {/* Selected day detail */}
              {selectedDay && (
                <div className="mt-4 bg-red-50 rounded-lg border border-red-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-red-700">{new Date(selectedDay + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14} /></button>
                  </div>
                  <div className="space-y-2">
                    {(data.attivita_programmate || []).filter(s => s.data_pianificata === selectedDay).map(s => (
                      <Link key={s.id} to={`/admin/projects/${s.progetto_id}/activities/${s.attivita_id}`} className="block bg-white rounded-lg p-3 border border-red-100 hover:shadow-sm transition-shadow">
                        <p className="text-sm text-gray-700">{s.nota}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {s.progetto_nome && <span className="text-purple-600">{s.progetto_nome}</span>}
                          {s.attivita_nome && <> &middot; {s.attivita_nome}</>}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Workload per technician (admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <button onClick={() => setShowCarico(!showCarico)} className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-purple-500" />
                <h2 className="text-lg font-semibold">Carico per Tecnico</h2>
              </div>
              {showCarico ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            {showCarico && (
              <div className="divide-y divide-gray-100 border-t border-gray-100">
                {data.carico_tecnici.map(u => (
                  <div key={u.id} className="p-4 flex items-center justify-between">
                    <p className="text-sm font-medium">{u.nome}</p>
                    <div className="flex gap-3 text-xs">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{u.ticket_attivi} ticket</span>
                      <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">{u.attivita_attive} attività</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Version footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        {APP_VERSION} &mdash; &copy; {new Date().getFullYear()} STM Domotica Corporation S.r.l.
      </div>
    </div>
  )
}
