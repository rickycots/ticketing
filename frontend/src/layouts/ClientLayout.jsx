import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { Ticket, FolderKanban, List, LogOut, Users, MessageCircle, X, Sparkles, Megaphone, ChevronDown, ChevronUp } from 'lucide-react'
import { t, getDateLocale } from '../i18n/clientTranslations'
import { clientAuth } from '../api/client'

const TEAMS_EMAIL = 'riccardocoates@stmdomoticacorporationsrl.onmicrosoft.com'
const TEAMS_CHAT_URL = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(TEAMS_EMAIL)}`

export default function ClientLayout() {
  const navigate = useNavigate()
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || 'null')
  const [showTeamsModal, setShowTeamsModal] = useState(false)
  const [comunicazioni, setComunicazioni] = useState([])
  const [showComms, setShowComms] = useState(true)

  // Verify token with backend on mount (background — doesn't block rendering)
  useEffect(() => {
    clientAuth.me().catch(() => {
      // Token invalid/expired → force logout
      sessionStorage.removeItem('clientToken')
      sessionStorage.removeItem('clientUser')
      window.location.href = '/client/login'
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
  const hasTicket = schede.includes('ticket')
  const hasProgetti = schede.includes('progetti')
  const hasAi = schede.includes('ai')
  const isClientAdmin = clientUser.ruolo === 'admin'

  const logoUrl = clientUser.logo ? `/uploads/logos/${clientUser.logo}` : null

  function handleLogout() {
    sessionStorage.removeItem('clientToken')
    sessionStorage.removeItem('clientUser')
    navigate('/client/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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
              {isClientAdmin && (
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
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 flex-1">
        {/* Communications banner */}
        {comunicazioni.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowComms(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">
                  {t('companyComms')} ({comunicazioni.length})
                </span>
              </div>
              {showComms ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
            </button>
            {showComms && (
              <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto">
                {comunicazioni.map(c => (
                  <div key={c.id} className="bg-white rounded-lg border border-blue-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-gray-900">{c.oggetto}</h4>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.data_ricezione).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {c.corpo && (
                      <p className="text-xs text-gray-600 mt-1.5 line-clamp-3 whitespace-pre-wrap leading-relaxed">{c.corpo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
              <p className="text-sm text-amber-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('chatDisclaimer') }} />
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
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <img src="/LogoSTM.png" alt="STM Domotica" className="h-5 w-auto object-contain opacity-60" />
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
