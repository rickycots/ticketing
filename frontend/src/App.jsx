import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import ClientLayout from './layouts/ClientLayout'
import Login from './pages/Login'
import ClientLogin from './pages/ClientLogin'
import Dashboard from './pages/admin/Dashboard'
import TicketList from './pages/admin/TicketList'
import TicketDetail from './pages/admin/TicketDetail'
import ProjectList from './pages/admin/ProjectList'
import ProjectDetail from './pages/admin/ProjectDetail'
import ActivityDetail from './pages/admin/ActivityDetail'
import ProjectGantt from './pages/admin/ProjectGantt'
import TimelineList from './pages/admin/TimelineList'
import EmailInbox from './pages/admin/EmailInbox'
import ClientList from './pages/admin/ClientList'
import ClientDetail from './pages/admin/ClientDetail'
import UserList from './pages/admin/UserList'
import Repository from './pages/admin/Repository'
import TicketForm from './pages/client/TicketForm'
import ClientTicketList from './pages/client/TicketList'
import ClientTicketDetail from './pages/client/TicketDetail'
import ProjectsView from './pages/client/ProjectsView'
import ClientProjectDetail from './pages/client/ClientProjectDetail'
import ClientUserManagement from './pages/client/UserManagement'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AdminOnly({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.ruolo !== 'admin') return <Navigate to="/admin" replace />
  return children
}

function ProtectedClientRoute({ children }) {
  const token = localStorage.getItem('clientToken')
  const { slug } = useParams()
  if (!token) return <Navigate to={`/client/${slug}/login`} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/client/:slug/login" element={<ClientLogin />} />

      {/* Admin Panel */}
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="tickets" element={<TicketList />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/activities/:activityId" element={<ActivityDetail />} />
        <Route path="projects/:id/gantt" element={<ProjectGantt />} />
        <Route path="timeline" element={<TimelineList />} />
        <Route path="repository" element={<Repository />} />
        <Route path="emails" element={<AdminOnly><EmailInbox /></AdminOnly>} />
        <Route path="clients" element={<AdminOnly><ClientList /></AdminOnly>} />
        <Route path="clients/:id" element={<AdminOnly><ClientDetail /></AdminOnly>} />
        <Route path="users" element={<AdminOnly><UserList /></AdminOnly>} />
      </Route>

      {/* Client Portal */}
      <Route path="/client/:slug" element={
        <ProtectedClientRoute>
          <ClientLayout />
        </ProtectedClientRoute>
      }>
        <Route index element={<Navigate to="tickets" replace />} />
        <Route path="tickets" element={<ClientTicketList />} />
        <Route path="tickets/new" element={<TicketForm />} />
        <Route path="tickets/:id" element={<ClientTicketDetail />} />
        <Route path="projects" element={<ProjectsView />} />
        <Route path="projects/:id" element={<ClientProjectDetail />} />
        <Route path="users" element={<ClientUserManagement />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
