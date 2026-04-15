import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { Ticket, FolderKanban, List, LogOut, Users, Sparkles, BarChart3, ShieldAlert, Megaphone, ChevronDown, Check, CircleCheck, X, AlertTriangle } from 'lucide-react'
import { t, getDateLocale } from '../i18n/clientTranslations'
import { clientAuth } from '../api/client'
import { APP_VERSION } from '../version'

export default function ClientLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || 'null')

  const [comunicazioni, setComunicazioni] = useState([])
  const [showComms, setShowComms] = useState(false)
  const [commsDismissed, setCommsDismissed] = useState(false)
  const [newVersionAvailable, setNewVersionAvailable] = useState(false)
  const [alerts, setAlerts] = useState({ attivita_bloccate: [], progetti_bloccati: [] })

  const sidebarThemes = [
    { id: 'gray', bg: 'bg-gray-700', border: 'border-gray-600', hover: 'hover:bg-gray-600', active: 'bg-blue-600', swatch: '#374151' },
    { id: 'slate', bg: 'bg-slate-800', border: 'border-slate-700', hover: 'hover:bg-slate-700', active: 'bg-blue-600', swatch: '#1e293b' },
    { id: 'zinc', bg: 'bg-zinc-800', border: 'border-zinc-700', hover: 'hover:bg-zinc-700', active: 'bg-emerald-600', swatch: '#27272a' },
    { id: 'indigo', bg: 'bg-indigo-900', border: 'border-indigo-800', hover: 'hover:bg-indigo-800', active: 'bg-indigo-500', swatch: '#312e81' },
    { id: 'teal', bg: 'bg-teal-900', border: 'border-teal-800', hover: 'hover:bg-teal-800', active: 'bg-teal-500', swatch: '#134e4a' },
    { id: 'rose', bg: 'bg-rose-900', border: 'border-rose-800', hover: 'hover:bg-rose-800', active: 'bg-rose-500', swatch: '#881337' },
    { id: 'amber', bg: 'bg-amber-900', border: 'border-amber-800', hover: 'hover:bg-amber-800', active: 'bg-amber-500', swatch: '#78350f' },
  ]
  const themeKey = clientUser ? `sidebar-theme-${clientUser.id}` : 'sidebar-theme'
  const [sidebarTheme, setSidebarTheme] = useState(() => {
    const saved = localStorage.getItem(themeKey)
    return sidebarThemes.find(t => t.id === saved) || sidebarThemes[0]
  })
  function changeTheme(theme) {
    setSidebarTheme(theme)
    localStorage.setItem(themeKey, theme.id)
  }

  useEffect(() => {
    clientAuth.me().catch(() => {
      sessionStorage.removeItem('clientToken')
      sessionStorage.removeItem('clientUser')
      window.location.href = `${import.meta.env.BASE_URL || '/'}client/login`
    })
  }, [])

  useEffect(() => {
    if (clientUser) {
      clientAuth.comunicazioni().then(setComunicazioni).catch(() => {})
    }
  }, [])

  // Reload alerts on every navigation + on custom event
  function reloadAlerts() {
    if (clientUser) clientAuth.alerts().then(setAlerts).catch(() => {})
  }
  useEffect(() => { reloadAlerts() }, [location.pathname])
  useEffect(() => {
    window.addEventListener('refresh-alerts', reloadAlerts)
    return () => window.removeEventListener('refresh-alerts', reloadAlerts)
  }, [])

  useEffect(() => {
    function checkVersion() {
      fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`)
        .then(r => r.json())
        .then(d => { if (d.version && d.version !== APP_VERSION) setNewVersionAvailable(true) })
        .catch(() => {})
    }
    checkVersion()
    const iv = setInterval(checkVersion, 60000)
    return () => clearInterval(iv)
  }, [])

  if (!clientUser) return <Navigate to="/client/login" replace />

  const schede = (clientUser.schede_visibili || '').split(',').filter(Boolean)
  const hasTicket = schede.includes('ticket') && (clientUser.servizio_ticket !== 0)
  const hasProgetti = schede.includes('progetti') && (clientUser.servizio_progetti !== 0)
  const hasAi = schede.includes('ai') && (clientUser.servizio_ai !== 0)
  const isClientAdmin = clientUser.ruolo === 'admin'
  const isImpersonated = !!clientUser.impersonated
  document.title = `STM-Portal : ${isClientAdmin ? 'client' : 'user'}`

  const path = location.pathname
  if (!hasTicket && (path.includes('/client/tickets') || path === '/client')) return <Navigate to={hasProgetti ? '/client/projects' : hasAi ? '/client/ai' : '/client/users'} replace />
  if (!hasProgetti && path.includes('/client/projects')) return <Navigate to={hasTicket ? '/client/tickets' : hasAi ? '/client/ai' : '/client/users'} replace />
  if (!hasAi && path.includes('/client/ai')) return <Navigate to={hasTicket ? '/client/tickets' : hasProgetti ? '/client/projects' : '/client/users'} replace />

  const logoUrl = clientUser.logo ? `${import.meta.env.VITE_API_BASE || '/api'}/uploads/logos/${clientUser.logo}` : null

  function handleLogout() {
    sessionStorage.removeItem('clientToken')
    sessionStorage.removeItem('clientUser')
    navigate('/client/login')
  }

  function handleExitImpersonation() {
    sessionStorage.removeItem('clientToken')
    sessionStorage.removeItem('clientUser')
    window.close()
  }

  // Build nav items based on permissions
  const navItems = []
  if (isClientAdmin) navItems.push({ to: '/client/dashboard', icon: BarChart3, label: t('dashboard') })
  if (hasTicket) {
    navItems.push({ to: '/client/tickets', icon: List, label: t('myTickets'), end: true })
    navItems.push({ to: '/client/tickets/new', icon: Ticket, label: t('openTicket') })
  }
  if (hasProgetti) navItems.push({ to: '/client/projects', icon: FolderKanban, label: t('myProjects') })
  if (hasAi) navItems.push({ to: '/client/ai', icon: Sparkles, label: t('aiNav') })
  if (isClientAdmin) navItems.push({ to: '/client/users', icon: Users, label: t('users') })

  const unreadComms = comunicazioni.filter(c => !c.letta)

  function SidebarClock() {
    const [now, setNow] = useState(new Date())
    useEffect(() => {
      const iv = setInterval(() => setNow(new Date()), 1000)
      return () => clearInterval(iv)
    }, [])
    return (
      <>
        <p className="text-[10px] text-gray-400">{now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p className="text-sm font-mono text-gray-300 tracking-wider">{now.toLocaleTimeString('it-IT')}</p>
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {isImpersonated && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md shrink-0">
          <ShieldAlert size={18} />
          <span>Stai operando come <strong>{clientUser.nome_azienda}</strong> — sessione admin impersonata (scade in 1h)</span>
          <button onClick={handleExitImpersonation} className="ml-4 bg-white text-amber-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-amber-50 transition-colors cursor-pointer">Esci</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`w-64 ${sidebarTheme.bg} text-white flex flex-col shrink-0`}>
          {/* Logo + info */}
          <div className={`p-3 border-b ${sidebarTheme.border}`}>
            <div className="flex items-center gap-3">
              {/* Left: Logo */}
              <div className="shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain rounded" />
                ) : (
                  <div className="w-14 h-14 bg-gray-600 rounded-xl flex items-center justify-center text-gray-300 text-2xl font-bold">
                    {(clientUser.nome_azienda || 'C')[0].toUpperCase()}
                  </div>
                )}
              </div>
              {/* Right: Version + Date + Clock */}
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">{APP_VERSION}</p>
                <SidebarClock />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={to === '/client/ai' ? (e) => {
                  if (window.location.pathname === '/client/ai') {
                    e.preventDefault()
                    window.dispatchEvent(new CustomEvent('ai-new-chat'))
                  }
                } : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? `${sidebarTheme.active} text-white`
                      : `text-gray-300 ${sidebarTheme.hover} hover:text-white`
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Communications badge */}
          {comunicazioni.length > 0 && (
            <div className={`px-3 pb-2 border-t ${sidebarTheme.border} pt-2`}>
              <div className="flex items-center gap-2 px-2 mb-1">
                <Megaphone size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comunicazioni</span>
                {unreadComms.length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadComms.length}</span>
                )}
              </div>
            </div>
          )}

          {/* Theme picker */}
          <div className={`px-3 py-2 border-t ${sidebarTheme.border} flex items-center justify-center gap-2`}>
            {sidebarThemes.map(theme => (
              <button
                key={theme.id}
                onClick={() => changeTheme(theme)}
                className={`w-5 h-5 rounded cursor-pointer transition-transform border border-white/40 ${sidebarTheme.id === theme.id ? 'ring-2 ring-white scale-110' : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
                style={{ backgroundColor: theme.swatch }}
                title={theme.id}
              />
            ))}
          </div>

          {/* User + logout */}
          <div className={`p-3 border-t ${sidebarTheme.border}`}>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-base" title={clientUser.lingua === 'en' ? 'English' : clientUser.lingua === 'fr' ? 'Français' : 'Italiano'}>
                  {clientUser.lingua === 'en' ? '🇬🇧' : clientUser.lingua === 'fr' ? '🇫🇷' : '🇮🇹'}
                </span>
                <div>
                  <p className="text-sm font-medium">{clientUser.nome}</p>
                  <p className="text-xs text-gray-400">{isClientAdmin ? 'Admin' : 'User'}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors cursor-pointer" title={t('logout')}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {/* Top bar */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {newVersionAvailable && (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm">
                  <span className="font-medium">Nuova versione disponibile</span>
                  <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold cursor-pointer hover:bg-blue-700">Aggiorna</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(alerts.ticket_in_attesa || []).length > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold animate-pulse">
                  <AlertTriangle size={14} />
                  Ticket in attesa tua risposta ({alerts.ticket_in_attesa.length})
                </div>
              )}
              {hasProgetti && alerts.attivita_bloccate.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold animate-pulse">
                  <AlertTriangle size={14} />
                  Attività bloccata ({alerts.attivita_bloccate.length})
                </div>
              )}
              {hasProgetti && alerts.progetti_bloccati.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold animate-pulse">
                  <AlertTriangle size={14} />
                  Progetto bloccato ({alerts.progetti_bloccati.length})
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowComms(prev => !prev); setCommsDismissed(false) }}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title="Comunicazioni"
              >
                <Megaphone size={20} className="text-gray-600" />
                {unreadComms.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadComms.length}
                  </span>
                )}
              </button>

              {/* Communications dropdown */}
              {showComms && comunicazioni.length > 0 && (
                <div className="absolute right-0 mt-1 w-96 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-30">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-sm text-gray-900">{t('companyComms')}</h3>
                    {unreadComms.length > 0 && (
                      <button onClick={() => {
                        clientAuth.comunicazioniReadAll().then(() => {
                          setComunicazioni(prev => prev.filter(c => c.importante).map(c => ({ ...c, letta: 1 })))
                        }).catch(() => {})
                      }} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                        <Check size={14} /> {t('markAllRead') || 'Lette tutte'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {comunicazioni.map(c => (
                      <div key={c.id} className={`px-4 py-3 border-b border-gray-50 ${!c.letta ? 'bg-blue-50/50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {c.importante && <Megaphone size={13} className="text-red-500 shrink-0" />}
                            <h4 className={`text-sm truncate ${!c.letta ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{c.oggetto}</h4>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-400">
                              {new Date(c.data_ricezione).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' })}
                            </span>
                            {!c.letta ? (
                              <button onClick={() => {
                                clientAuth.comunicazioneRead(c.id).then(() => {
                                  setComunicazioni(prev => c.importante
                                    ? prev.map(x => x.id === c.id ? { ...x, letta: 1 } : x)
                                    : prev.filter(x => x.id !== c.id)
                                  )
                                }).catch(() => {})
                              }} className="p-0.5 rounded text-blue-400 hover:text-green-600 cursor-pointer">
                                <CircleCheck size={15} />
                              </button>
                            ) : <CircleCheck size={15} className="text-green-400" />}
                          </div>
                        </div>
                        {c.corpo && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.corpo}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
