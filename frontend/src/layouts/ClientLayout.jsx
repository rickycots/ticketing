import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { Ticket, FolderKanban, List, LogOut, Users, MessageCircle, X, Sparkles, Megaphone, ChevronDown, ChevronUp, Check, CircleCheck, ShieldAlert, BarChart3 } from 'lucide-react'
import { t, getDateLocale } from '../i18n/clientTranslations'
import { clientAuth } from '../api/client'
import { APP_VERSION } from '../version'

const TEAMS_EMAIL = 'riccardocoates@stmdomoticacorporationsrl.onmicrosoft.com'
const TEAMS_CHAT_URL = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(TEAMS_EMAIL)}`

export default function ClientLayout() {
  const navigate = useNavigate()
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || 'null')
  const [showTeamsModal, setShowTeamsModal] = useState(false)
  const [comunicazioni, setComunicazioni] = useState([])
  const [showComms, setShowComms] = useState(false)
  const [commsDismissed, setCommsDismissed] = useState(false)

  // Verify token with backend on mount (background — doesn't block rendering)
  useEffect(() => {
    clientAuth.me().catch(() => {
      // Token invalid/expired → force logout
      sessionStorage.removeItem('clientToken')
      sessionStorage.removeItem('clientUser')
      window.location.href = `${import.meta.env.BASE_URL || '/'}client/login`
    })
  }, [])

  // Load client communications
  useEffect(() => {
    if (clientUser) {
      clientAuth.comunicazioni().then(setComunicazioni).catch(() => {})
    }
  }, [])

  if (!clientUser) return <Navigate to="/client/login" replace />

  const schede = (clientUser.schede_visibili || '').split(',').filter(Boolean)
  const hasTicket = schede.includes('ticket') && (clientUser.servizio_ticket !== 0)
  const hasProgetti = schede.includes('progetti') && (clientUser.servizio_progetti !== 0)
  const hasAi = schede.includes('ai') && (clientUser.servizio_ai !== 0)
  const isClientAdmin = clientUser.ruolo === 'admin'
  const isImpersonated = !!clientUser.impersonated
  document.title = `STM-Portal : ${isClientAdmin ? 'client' : 'user'}`
  const [newVersionAvailable, setNewVersionAvailable] = useState(false)

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
  const location = useLocation()

  // Block access to disabled services via direct URL
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {newVersionAvailable && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
          <span>Nuova versione disponibile</span>
          <button onClick={() => window.location.reload()} className="bg-white text-blue-600 px-3 py-0.5 rounded-full text-xs font-bold cursor-pointer hover:bg-blue-50">Aggiorna</button>
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : null}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{clientUser.nome_azienda || t('clientPortal')}</h1>
              <p className="text-xs text-gray-500">{clientUser.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <nav className="flex gap-1">
              {hasAi && (
                <NavLink
                  to="/client/ai"
                  onClick={(e) => {
                    if (window.location.pathname === '/client/ai') {
                      e.preventDefault()
                      window.dispatchEvent(new CustomEvent('ai-new-chat'))
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <Sparkles size={16} />
                  {t('aiNav')}
                </NavLink>
              )}
              {hasTicket && (
                <>
                  <NavLink
                    to="/client/tickets"
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <List size={16} />
                    {t('myTickets')}
                  </NavLink>
                  <NavLink
                    to="/client/tickets/new"
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Ticket size={16} />
                    {t('openTicket')}
                  </NavLink>
                </>
              )}
              {hasProgetti && (
                <NavLink
                  to="/client/projects"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <FolderKanban size={16} />
                  {t('myProjects')}
                </NavLink>
              )}
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-2"
            >
              <LogOut size={16} />
              {t('logout')}
            </button>
          </div>
        </div>
        {isClientAdmin && (
          <div className="max-w-6xl mx-auto px-4 pb-2 flex justify-end gap-1">
            <NavLink
              to="/client/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <BarChart3 size={16} />
              {t('dashboard')}
            </NavLink>
            <NavLink
              to="/client/users"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Users size={16} />
              {t('users')}
            </NavLink>
          </div>
        )}
      </header>

      {/* Impersonation banner */}
      {isImpersonated && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
          <ShieldAlert size={18} />
          <span>Stai operando come <strong>{clientUser.nome_azienda}</strong> — sessione admin impersonata (scade in 1h)</span>
          <button
            onClick={handleExitImpersonation}
            className="ml-4 bg-white text-amber-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-amber-50 transition-colors cursor-pointer"
          >
            Esci
          </button>
        </div>
      )}

      {/* Content */}
      <main className="w-full max-w-6xl mx-auto px-4 py-6 flex-1">
        {/* Communications banner — unread + important (even if read) */}
        {comunicazioni.length > 0 && !commsDismissed && (() => {
          const unread = comunicazioni.filter(c => !c.letta)
          const importanti = comunicazioni.filter(c => c.importante)
          return (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-2.5">
              <Megaphone size={18} className="text-blue-600 shrink-0" />
              <button
                onClick={() => setShowComms(prev => !prev)}
                className="flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span className="text-sm font-semibold text-blue-800">
                  {t('companyComms')}
                  {unread.length > 0 && <span className="ml-1 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{unread.length}</span>}
                  {importanti.length > 0 && <span className="ml-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{importanti.length}</span>}
                </span>
                <ChevronDown size={14} className={`text-blue-500 transition-transform ${showComms ? 'rotate-180' : ''}`} />
              </button>
              {unread.length > 0 && (
                <button
                  onClick={() => {
                    clientAuth.comunicazioniReadAll().then(() => {
                      setComunicazioni(prev => prev.filter(c => c.importante).map(c => ({ ...c, letta: 1 })))
                    }).catch(() => {})
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer shrink-0 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Check size={13} />
                  {t('markAllRead') || 'Lette tutte'}
                </button>
              )}
              {/* Scrolling marquee of latest unread */}
              {unread.length > 0 && (
                <div className="flex-1 overflow-hidden mx-2">
                  <div className="whitespace-nowrap animate-marquee text-sm text-gray-900">
                    <span className="italic underline">Ultimo msg:</span>{' '}
                    <span className="font-bold">{unread[0].oggetto}</span>
                    {unread[0].corpo && <span className="ml-1.5 font-normal text-gray-700">— {unread[0].corpo}</span>}
                  </div>
                </div>
              )}
              {unread.length === 0 && <div className="flex-1" />}
              <button
                onClick={() => setCommsDismissed(true)}
                className="shrink-0 p-1 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-700 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Expanded content */}
            {showComms && (
              <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto border-t border-blue-200">
                {comunicazioni.map(c => (
                  <div key={c.id} className={`rounded-lg border p-3 mt-2 ${c.letta ? 'bg-white border-blue-100' : 'bg-blue-100/50 border-blue-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {c.importante ? <Megaphone size={14} className="text-red-500 shrink-0" /> : null}
                        <h4 className={`text-sm ${c.letta ? 'font-medium text-gray-600' : 'font-semibold text-gray-900'}`}>{c.oggetto}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(c.data_ricezione).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {!c.letta && (
                          <button
                            onClick={() => {
                              clientAuth.comunicazioneRead(c.id).then(() => {
                                setComunicazioni(prev => c.importante
                                  ? prev.map(x => x.id === c.id ? { ...x, letta: 1 } : x)
                                  : prev.filter(x => x.id !== c.id)
                                )
                              }).catch(() => {})
                            }}
                            className="p-1 rounded-lg text-blue-400 hover:text-green-600 hover:bg-green-50 cursor-pointer transition-colors"
                            title={t('markAllRead') || 'Segna come letta'}
                          >
                            <CircleCheck size={16} />
                          </button>
                        )}
                        {c.letta && (
                          <CircleCheck size={16} className="text-green-400" />
                        )}
                      </div>
                    </div>
                    {c.corpo && (
                      <p className="text-xs text-gray-600 mt-1.5 line-clamp-3 whitespace-pre-wrap leading-relaxed">{c.corpo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )
        })()}
        <Outlet />
      </main>

      {/* Teams Chat FAB */}
      <button
        onClick={() => setShowTeamsModal(true)}
        className="fixed bottom-6 right-6 bg-[#5b5fc7] hover:bg-[#4b4fbf] text-white rounded-full p-4 shadow-lg cursor-pointer transition-all hover:scale-105 z-40"
        title={t('chatWithUs')}
      >
        <MessageCircle size={24} />
      </button>

      {/* Teams Modal */}
      {showTeamsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => setShowTeamsModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#5b5fc7] rounded-lg p-2">
                <MessageCircle size={22} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('chatSupport')}</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
              <p className="text-sm text-amber-800 leading-relaxed">{t('chatDisclaimerPre')}<strong>{t('chatDisclaimerBold')}</strong>{t('chatDisclaimerPost')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={TEAMS_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowTeamsModal(false)}
                className="flex items-center justify-center gap-2 bg-[#5b5fc7] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#4b4fbf] transition-colors"
              >
                <MessageCircle size={16} />
                {t('openTeamsChat')}
              </a>
              <NavLink
                to="/client/tickets/new"
                onClick={() => setShowTeamsModal(false)}
                className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                <Ticket size={16} />
                {t('openATicket')}
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL || '/'}LogoSTM.png`} alt="STM Domotica" className="h-5 w-auto object-contain opacity-60" />
              <span>&copy; {new Date().getFullYear()} Stmdomotica Corporation Srl</span>
            </div>
            <div className="text-center sm:text-right leading-relaxed">
              <span>Via Aldo Moro 15 &mdash; 26839 Zelo Buon Persico (LO)</span>
              <span className="mx-1.5">&middot;</span>
              <span>{t('allRights')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
