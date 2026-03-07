import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Mail, CheckCircle2, Clock, Wrench, Lock, CalendarClock } from 'lucide-react'
import { clientProjects } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'

const statoColors = {
  attivo: 'bg-green-100 text-green-800',
  in_pausa: 'bg-yellow-100 text-yellow-800',
  completato: 'bg-blue-100 text-blue-800',
  annullato: 'bg-gray-100 text-gray-600',
}

const actStatoColors = {
  da_fare: 'border-l-gray-400 bg-gray-50',
  in_corso: 'border-l-blue-500 bg-blue-50/30',
  completata: 'border-l-green-500 bg-green-50/30',
  bloccata: 'border-l-red-500 bg-red-50/30',
}

const actStatoBadge = {
  da_fare: 'bg-gray-100 text-gray-700',
  in_corso: 'bg-blue-100 text-blue-700',
  completata: 'bg-green-100 text-green-700',
  bloccata: 'bg-red-100 text-red-700',
}

function getActLabel(stato) {
  const map = { da_fare: 'actTodo', in_corso: 'actInProgress', completata: 'actCompleted', bloccata: 'actBlocked' }
  return t(map[stato] || stato)
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ClientProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    clientProjects.get(clienteId, id)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId, id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('loading')}</div>
  if (!project) return <div className="text-center text-gray-400 py-12">{t('projectNotFound')}</div>

  const isBloccato = project.blocco === 'lato_cliente'

  // Build tree: parent activities and their children
  const parentActivities = project.attivita.filter(a => !a.dipende_da)
  const childMap = {}
  project.attivita.forEach(a => {
    if (a.dipende_da) {
      if (!childMap[a.dipende_da]) childMap[a.dipende_da] = []
      childMap[a.dipende_da].push(a)
    }
  })

  function renderActivity(act, indent = 0) {
    const children = childMap[act.id] || []
    return (
      <div key={act.id}>
        <div
          className={`border-l-4 rounded-lg p-4 ${actStatoColors[act.stato] || actStatoColors.da_fare}`}
          style={{ marginLeft: indent * 24 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                {act.ordine && (
                  <span className="text-xs font-bold text-gray-400">#{act.ordine}</span>
                )}
                <h4 className="font-medium text-gray-900 text-sm">{act.nome}</h4>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actStatoBadge[act.stato]}`}>
                  {getActLabel(act.stato)}
                </span>
                {act.data_scadenza && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <CalendarClock size={12} />
                    {t('deadline')}: {formatDate(act.data_scadenza)}
                  </span>
                )}
                {act.data_completamento && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {t('completedOn')}: {formatDate(act.data_completamento)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${act.avanzamento === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${act.avanzamento}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-600 w-8 text-right">{act.avanzamento}%</span>
            </div>
          </div>
        </div>
        {children.map(child => renderActivity(child, indent + 1))}
      </div>
    )
  }

  return (
    <div>
      {/* Back link */}
      <Link to="/client/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> {t('backToProjects')}
      </Link>

      {/* Blocking email alert */}
      {isBloccato && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-orange-600" />
            <span className="font-semibold text-orange-800">{t('waitingForYou')}</span>
          </div>
          {project.email_bloccante_oggetto && (
            <div className="bg-white rounded-lg border border-orange-200 p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Mail size={16} className="text-orange-600" />
                <h4 className="font-medium text-gray-900 text-sm">{project.email_bloccante_oggetto}</h4>
              </div>
              {project.email_bloccante_data && (
                <p className="text-xs text-gray-400 mb-2">{t('sentOn')} {formatDate(project.email_bloccante_data)}</p>
              )}
              {project.email_bloccante_corpo && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-3 mt-2">
                  {project.email_bloccante_corpo}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Project header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.nome}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[project.stato]}`}>
                {project.stato.replace('_', ' ')}
              </span>
              {project.data_scadenza && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <CalendarClock size={14} />
                  {t('expectedCompletion')}: <span className="font-medium text-gray-700">{formatDate(project.data_scadenza)}</span>
                </span>
              )}
            </div>
          </div>
          {isBloccato ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-orange-700 font-medium text-sm">
                <AlertTriangle size={16} />
                {t('waiting')}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 text-blue-700 font-medium text-sm">
                <Wrench size={16} />
                {t('inProgress')}
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-500">{t('progress')}</span>
            <span className="font-bold text-gray-900">{project.avanzamento}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${project.avanzamento === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${project.avanzamento}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{project.attivita.length} {t('activities').toLowerCase()}</p>
        </div>
      </div>

      {/* Activities list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('activities')}</h2>
        </div>
        {project.attivita.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('noActivities')}</div>
        ) : (
          <div className="p-4 space-y-2">
            {parentActivities.map(act => renderActivity(act))}
          </div>
        )}
      </div>
    </div>
  )
}
