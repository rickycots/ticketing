import { Outlet, NavLink, useNavigate, Navigate, useParams } from 'react-router-dom'
import { Ticket, FolderKanban, List, LogOut, Users } from 'lucide-react'

export default function ClientLayout() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const clientUser = JSON.parse(localStorage.getItem('clientUser') || 'null')

  if (!clientUser) return <Navigate to={`/client/${slug}/login`} replace />

  const schede = (clientUser.schede_visibili || '').split(',').filter(Boolean)
  const hasTicket = schede.includes('ticket')
  const hasProgetti = schede.includes('progetti')
  const isClientAdmin = clientUser.ruolo === 'admin'

  const logoUrl = clientUser.logo ? `/uploads/logos/${clientUser.logo}` : null

  function handleLogout() {
    localStorage.removeItem('clientToken')
    localStorage.removeItem('clientUser')
    navigate(`/client/${slug}/login`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : null}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{clientUser.nome_azienda || 'Portale Cliente'}</h1>
              <p className="text-xs text-gray-500">{clientUser.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <nav className="flex gap-1">
              {hasTicket && (
                <>
                  <NavLink
                    to={`/client/${slug}/tickets`}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <List size={16} />
                    I Miei Ticket
                  </NavLink>
                  <NavLink
                    to={`/client/${slug}/tickets/new`}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Ticket size={16} />
                    Apri Ticket
                  </NavLink>
                </>
              )}
              {hasProgetti && (
                <NavLink
                  to={`/client/${slug}/projects`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <FolderKanban size={16} />
                  I Miei Progetti
                </NavLink>
              )}
              {isClientAdmin && (
                <NavLink
                  to={`/client/${slug}/users`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <Users size={16} />
                  Utenti
                </NavLink>
              )}
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-2"
            >
              <LogOut size={16} />
              Esci
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
