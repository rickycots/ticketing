import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Phone, User } from 'lucide-react'
import { projects } from '../../api/client'
import GanttChart from '../../components/GanttChart'

const statoColors = {
  attivo: 'bg-green-100 text-green-800',
  in_pausa: 'bg-yellow-100 text-yellow-800',
  completato: 'bg-blue-100 text-blue-800',
  annullato: 'bg-gray-100 text-gray-600',
}

export default function ProjectGantt() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    projects.get(id)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Caricamento...</div>
  if (!project) return <div className="text-center text-gray-400 py-12">Progetto non trovato</div>

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <Link to="/admin/timeline" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Torna alla timeline
        </Link>
      </div>

      {/* Client Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-teal-900">{project.cliente_nome}</h2>
            {(project.cliente_email || project.cliente_telefono || project.cliente_referente) && (
              <div className="flex items-center gap-4 text-sm text-teal-700 mt-0.5">
                {project.cliente_email && <span className="flex items-center gap-1"><Mail size={13} /> {project.cliente_email}</span>}
                {project.cliente_telefono && <span className="flex items-center gap-1"><Phone size={13} /> {project.cliente_telefono}</span>}
                {project.cliente_referente && <span className="flex items-center gap-1"><User size={13} /> {project.cliente_referente}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">{project.nome}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{project.cliente_nome}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[project.stato]}`}>
            {project.stato.replace('_', ' ')}
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${project.avanzamento}%` }} />
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-700">{project.avanzamento}%</span>
          <span className="text-sm text-gray-400">{project.attivita.length} attivita</span>
        </div>
      </div>

      {/* Gantt Chart */}
      <GanttChart
        attivita={project.attivita}
        projectStart={project.data_inizio}
        projectEnd={project.data_scadenza}
        projectId={id}
      />
    </div>
  )
}
