import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FolderKanban, AlertTriangle, Wrench, CalendarClock, ChevronDown, ChevronUp, Mail } from 'lucide-react'
import { clientProjects } from '../../api/client'

function getUpdateColor(updatedAt) {
  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 3) return { dot: 'bg-green-500', label: 'Aggiornato di recente' }
  if (days < 7) return { dot: 'bg-yellow-500', label: 'Aggiornato da qualche giorno' }
  return { dot: 'bg-red-500', label: 'Non aggiornato da tempo' }
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ProjectsView() {
  const { slug } = useParams()
  const [projectList, setProjectList] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedEmail, setExpandedEmail] = useState(null)
  const clientUser = JSON.parse(localStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    clientProjects.list(clienteId)
      .then(setProjectList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">I Miei Progetti</h2>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : projectList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <FolderKanban size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Nessun progetto attivo</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projectList.map(p => {
            const updateStatus = getUpdateColor(p.updated_at)
            const isBloccato = p.blocco === 'lato_cliente'
            const hasEmailContent = isBloccato && p.email_bloccante_corpo
            const isExpanded = expandedEmail === p.id

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/client/${slug}/projects/${p.id}`}>
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">{p.nome}</h3>
                      </Link>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${updateStatus.dot}`} />
                          <span className="text-xs text-gray-500">
                            Aggiornato: {new Date(p.updated_at).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                        {p.data_scadenza && (
                          <div className="flex items-center gap-1.5">
                            <CalendarClock size={14} className="text-gray-400" />
                            <span className="text-xs text-gray-500">
                              Completamento previsto: <span className="font-medium text-gray-700">{formatDate(p.data_scadenza)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Block Badge */}
                    {isBloccato ? (
                      <button
                        onClick={() => hasEmailContent && setExpandedEmail(isExpanded ? null : p.id)}
                        className={`bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 max-w-xs text-left transition-colors ${hasEmailContent ? 'cursor-pointer hover:bg-orange-100' : ''}`}
                      >
                        <div className="flex items-center gap-1.5 text-orange-700 font-medium text-sm">
                          <AlertTriangle size={16} className="shrink-0" />
                          <span>In attesa di tuo riscontro</span>
                          {hasEmailContent && (
                            isExpanded
                              ? <ChevronUp size={14} className="shrink-0 ml-1" />
                              : <ChevronDown size={14} className="shrink-0 ml-1" />
                          )}
                        </div>
                        {p.email_bloccante_oggetto && !isExpanded && (
                          <p className="text-xs text-orange-600 mt-1 line-clamp-1">
                            {p.email_bloccante_oggetto}
                          </p>
                        )}
                      </button>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1.5 text-blue-700 font-medium text-sm">
                          <Wrench size={16} />
                          In lavorazione
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-500">Stato avanzamento</span>
                      <span className="font-bold text-gray-900">{p.avanzamento}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          p.avanzamento === 100 ? 'bg-green-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${p.avanzamento}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded blocking email */}
                {isExpanded && hasEmailContent && (
                  <div className="border-t border-orange-200 bg-orange-50/50 px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail size={16} className="text-orange-600" />
                      <span className="text-sm font-semibold text-orange-800">Comunicazione in attesa di risposta</span>
                    </div>
                    <div className="bg-white rounded-lg border border-orange-200 p-4">
                      <h4 className="font-medium text-gray-900 text-sm">{p.email_bloccante_oggetto}</h4>
                      {p.email_bloccante_data && (
                        <p className="text-xs text-gray-400 mt-1">
                          Inviata il {formatDate(p.email_bloccante_data)}
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{p.email_bloccante_corpo}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
