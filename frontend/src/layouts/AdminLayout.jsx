import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import { LayoutDashboard, Ticket, Mail, Send, Users, UserCog, LogOut, MessageCircle, Bell, Check, CheckCheck, BarChart3, BookOpen, Megaphone, Sparkles, FolderKanban, ChevronDown, Menu, X } from 'lucide-react'
import { auth, projects, notifications, dashboard } from '../api/client'
import { APP_VERSION } from '../version'

const allNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/admin/projects', icon: FolderKanban, label: 'Progetti', expandable: true, children: [
    { to: '/admin/timeline', icon: BarChart3, label: 'Timeline Progetti' },
  ]},
  { to: '/admin/emails', icon: Mail, label: 'Email', adminOnly: true },
  { to: '/admin/send-mail', icon: Send, label: 'Invia Mail' },
  { to: '/admin/clients', icon: Users, label: 'Clienti', adminOnly: true },
  { to: '/admin/users', icon: UserCog, label: 'Utenti', adminOnly: true },
  { separator: true, adminOnly: true },
  { to: '/admin/comunicazioni', icon: Megaphone, label: 'Comunicazioni', adminOnly: true },
]

const bottomNavItems = [
  { to: '/admin/ai', icon: Sparkles, label: 'AI Assistente' },
  { to: '/admin/repository', icon: BookOpen, label: 'Repository', adminOnly: true },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  document.title = `STM-Portal : ${user.ruolo === 'admin' ? 'admin' : 'tecnico'}`
  const navItems = allNavItems.filter(item => !item.adminOnly || user.ruolo === 'admin')
  const bottomItems = bottomNavItems.filter(item => {
    if (item.adminOnly && user.ruolo !== 'admin') return false
    if (item.to === '/admin/ai' && user.ruolo !== 'admin' && !user.abilitato_ai) return false
    return true
  })
  // Block direct URL access to AI for non-enabled technicians
  if (location.pathname === '/admin/ai' && user.ruolo !== 'admin' && !user.abilitato_ai) {
    return <Navigate to="/admin" replace />
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on navigation
  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  const [expandedMenus, setExpandedMenus] = useState(() => {
    // Auto-expand if current path is inside a submenu
    const expanded = {}
    allNavItems.filter(i => i.expandable && i.children).forEach(item => {
      if (location.pathname.startsWith(item.to) || item.children.some(c => location.pathname.startsWith(c.to))) {
        expanded[item.to] = true
      }
    })
    return expanded
  })
  const [chatNotifs, setChatNotifs] = useState([])
  const [sidebarCounts, setSidebarCounts] = useState({ tickets_nuovi: 0, email_nuove: 0 })
  const [newVersionAvailable, setNewVersionAvailable] = useState(false)

  // Version check every 60s
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

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifList, setNotifList] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifRef = useRef(null)

  // Verify token with backend on mount (background)
  useEffect(() => {
    auth.me().catch(() => {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      window.location.href = `${import.meta.env.BASE_URL || '/'}login`
    })
  }, [])

  useEffect(() => {
    loadChatNotifs()
    loadSidebarCounts()
  }, [location.pathname])

  function loadChatNotifs() {
    projects.chatUnread().then(setChatNotifs).catch(() => {})
  }

  // Load notification count on mount and poll every 30s
  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load sidebar counts (new tickets/emails since last login)
  useEffect(() => {
    loadSidebarCounts()
    const interval = setInterval(loadSidebarCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  function loadUnreadCount() {
    notifications.unreadCount().then(res => setUnreadCount(res.count)).catch(() => {})
  }

  function loadSidebarCounts() {
    const since = sessionStorage.getItem('lastLoginTime')
    dashboard.sidebarCounts(since).then(setSidebarCounts).catch(() => {})
  }

  async function toggleNotifPanel() {
    if (!showNotifPanel) {
      try {
        const list = await notifications.list()
        setNotifList(list)
      } catch (e) { /* ignore */ }
    }
    setShowNotifPanel(prev => !prev)
  }

  async function handleNotifClick(notif) {
    if (!notif.letta) {
      await notifications.markRead(notif.id).catch(() => {})
      setUnreadCount(c => Math.max(0, c - 1))
      setNotifList(prev => prev.map(n => n.id === notif.id ? { ...n, letta: 1 } : n))
    }
    setShowNotifPanel(false)
    if (notif.link) navigate(notif.link)
  }

  async function handleMarkAllRead() {
    await notifications.markAllRead().catch(() => {})
    setUnreadCount(0)
    setNotifList(prev => prev.map(n => ({ ...n, letta: 1 })))
  }

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifPanel(false)
      }
    }
    if (showNotifPanel) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotifPanel])

  function handleLogout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/login')
  }

  const totalUnread = chatNotifs.reduce((sum, p) => sum + p.non_lette, 0)

  return (
    <div className="flex flex-col h-screen">
      {newVersionAvailable && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm shrink-0">
          <span>Nuova versione disponibile</span>
          <button onClick={() => window.location.reload()} className="bg-white text-blue-600 px-3 py-0.5 rounded-full text-xs font-bold cursor-pointer hover:bg-blue-50">Aggiorna</button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={`w-64 bg-gray-900 text-white flex flex-col shrink-0 fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-700">
          <p className="text-[10px] text-gray-500 mb-1">{APP_VERSION}</p>
          <h1 className="text-lg font-bold">Ticketing</h1>
          <p className="text-xs text-gray-400">Pannello Gestione</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item, idx) => {
            if (item.separator) return <hr key={`sep-${idx}`} className="border-gray-700 my-2" />
            const { to, icon: Icon, label, end, expandable, children } = item
            const isExpanded = !!expandedMenus[to]
            const isChildActive = children && children.some(c => location.pathname.startsWith(c.to))
            const isParentActive = location.pathname === to || location.pathname.startsWith(to + '/')

            if (expandable) {
              return (
                <div key={to}>
                  <NavLink
                    to={to}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive || isChildActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={18} />
                    {label}
                    {totalUnread > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {totalUnread}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`ml-auto transition-transform cursor-pointer ${isExpanded ? 'rotate-180' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedMenus(prev => ({ ...prev, [to]: !prev[to] })) }}
                    />
                  </NavLink>
                  {isExpanded && children && children.map(child => {
                    const ChildIcon = child.icon
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-9 pr-3 py-1.5 rounded-lg text-xs transition-colors mt-0.5 ${
                            isActive
                              ? 'bg-blue-600/80 text-white'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }`
                        }
                      >
                        <ChildIcon size={14} />
                        {child.label}
                      </NavLink>
                    )
                  })}
                </div>
              )
            }

            return (
            <div key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {label}
                {label === 'Tickets' && sidebarCounts.tickets_nuovi > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {sidebarCounts.tickets_nuovi}
                  </span>
                )}
                {label === 'Email' && sidebarCounts.email_nuove > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {sidebarCounts.email_nuove}
                  </span>
                )}
              </NavLink>
              {children && children.map(child => {
                const ChildIcon = child.icon
                return (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 pl-9 pr-3 py-1.5 rounded-lg text-xs transition-colors ${
                        isActive
                          ? 'bg-blue-600/80 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <ChildIcon size={14} />
                    {child.label}
                  </NavLink>
                )
              })}
            </div>
          )})}
        </nav>

        {/* Bottom nav items (separated) */}
        {bottomItems.length > 0 && (
          <div className="px-3 pb-2 border-t border-gray-700 pt-2">
            {bottomItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Chat notifications */}
        {chatNotifs.length > 0 && (
          <div className="px-3 pb-2 border-t border-gray-700 pt-2">
            <div className="flex items-center gap-2 px-2 mb-2">
              <MessageCircle size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chat</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {chatNotifs.map(p => (
                <Link
                  key={p.id}
                  to={`/admin/projects/${p.id}`}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-gray-800 transition-colors"
                >
                  <span className="text-gray-300 truncate flex-1 mr-2">{p.nome}</span>
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                    {p.non_lette}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-medium">{user.nome || 'Utente'}</p>
              <p className="text-xs text-gray-400">{user.ruolo || ''}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Esci"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar with notifications */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center justify-between lg:justify-end">
          <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
            <Menu size={22} className="text-gray-600" />
          </button>
          <div className="relative" ref={notifRef}>
            <button
              onClick={toggleNotifPanel}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Notifiche"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifPanel && (
              <div className="absolute right-0 mt-1 w-96 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-sm text-gray-900">Notifiche</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <CheckCheck size={14} />
                      Segna tutte come lette
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifList.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">Nessuna notifica</div>
                  ) : (
                    notifList.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 ${
                          !n.letta ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.letta ? 'bg-blue-500' : 'bg-transparent'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${!n.letta ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {n.titolo}
                            </p>
                            {n.messaggio && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{n.messaggio}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(n.created_at).toLocaleString('it-IT')}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 lg:p-6">
          <Outlet context={{ loadSidebarCounts }} />
        </div>
      </main>
    </div>
    </div>
  )
}
