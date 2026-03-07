import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, AlertTriangle, Wrench, CalendarClock, ChevronDown, ChevronUp, Mail, ChevronRight, Paperclip, FileText, Download } from 'lucide-react'
import { clientProjects } from '../../api/client'
import { t, getDateLocale } from '../../i18n/clientTranslations'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIconColor(mime) {
  if (!mime) return 'text-gray-400'
  if (mime.includes('pdf')) return 'text-red-500'
  if (mime.includes('image')) return 'text-blue-500'
  if (mime.includes('word') || mime.includes('document')) return 'text-blue-600'
  if (mime.includes('sheet') || mime.includes('excel')) return 'text-green-600'
  if (mime.includes('zip') || mime.includes('archive')) return 'text-yellow-600'
  return 'text-gray-400'
}

export default function ProjectsView() {
  const [projectList, setProjectList] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedEmail, setExpandedEmail] = useState(null)
  const [expandedDesc, setExpandedDesc] = useState({})
  const [expandedAllegati, setExpandedAllegati] = useState({})
  const [allegatiData, setAllegatiData] = useState({})
  const [loadingAllegati, setLoadingAllegati] = useState({})
  const clientUser = JSON.parse(sessionStorage.getItem('clientUser') || '{}')
  const clienteId = clientUser.cliente_id

  function getUpdateColor(updatedAt) {
    const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days < 3) return { dot: 'bg-green-500', label: t('updatedRecently') }
    if (days < 7) return { dot: 'bg-yellow-500', label: t('updatedFewDays') }
    return { dot: 'bg-red-500', label: t('notUpdatedLong') }
  }

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    clientProjects.list(clienteId)
      .then(setProjectList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId])

  function toggleAllegati(projectId) {
    const isOpen = expandedAllegati[projectId]
    setExpandedAllegati(prev => ({ ...prev, [projectId]: !isOpen }))

    // Load attachments on first open
    if (!isOpen && !allegatiData[projectId]) {
      setLoadingAllegati(prev => ({ ...prev, [projectId]: true }))
      clientProjects.allegati(clienteId, projectId)
        .then(data => setAllegatiData(prev => ({ ...prev, [projectId]: data })))
        .catch(() => setAllegatiData(prev => ({ ...prev, [projectId]: [] })))
        .finally(() => setLoadingAllegati(prev => ({ ...prev, [projectId]: false })))
    }
  }

  function handleDownload(projectId, allegatoId, nome) {
    const token = sessionStorage.getItem('clientToken')
    const url = clientProjects.downloadUrl(clienteId, projectId, allegatoId)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = nome
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">{t('myProjects')}</h2>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('loading')}</div>
      ) : projectList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <FolderKanban size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">{t('noActiveProjects')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projectList.map(p => {
            const updateStatus = getUpdateColor(p.updated_at)
            const isBloccato = p.blocco === 'lato_cliente'
            const hasEmailContent = isBloccato && p.email_bloccante_corpo
            const isExpanded = expandedEmail === p.id
            const isAllegatiOpen = expandedAllegati[p.id]
            const files = allegatiData[p.id] || []
            const isLoadingFiles = loadingAllegati[p.id]

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/client/projects/${p.id}`}>
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">{p.nome}</h3>
                      </Link>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${updateStatus.dot}`} />
                          <span className="text-xs text-gray-500">
                            {t('updatedOn')}: {new Date(p.updated_at).toLocaleDateString(getDateLocale())}
                          </span>
                        </div>
                        {p.data_scadenza && (
                          <div className="flex items-center gap-1.5">
                            <CalendarClock size={14} className="text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {t('expectedCompletion')}: <span className="font-medium text-gray-700">{formatDate(p.data_scadenza)}</span>
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
                          <span>{t('waitingForYou')}</span>
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
                          {t('inProgress')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-500">{t('progress')}</span>
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

                  {/* Descrizione + Allegati toggles */}
                  <div className="flex items-center gap-4 mt-3">
                    <button
                      onClick={() => setExpandedDesc(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={14} className={`transition-transform ${expandedDesc[p.id] ? 'rotate-90' : ''}`} />
                      <span className="font-medium">{t('shortDescription')}</span>
                    </button>
                    <button
                      onClick={() => toggleAllegati(p.id)}
                      className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${isAllegatiOpen ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Paperclip size={14} className={isAllegatiOpen ? 'text-blue-500' : ''} />
                      <span className="font-medium">{t('projectAttachments')}</span>
                      {files.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">{files.length}</span>
                      )}
                    </button>
                  </div>

                  {/* Expanded description */}
                  {expandedDesc[p.id] && (
                    <div className="mt-2 pl-5 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {p.descrizione || <span className="text-gray-400 italic">{t('noDescription')}</span>}
                    </div>
                  )}

                  {/* Expanded allegati */}
                  {isAllegatiOpen && (
                    <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      {isLoadingFiles ? (
                        <div className="p-4 text-center text-xs text-gray-400">{t('loading')}</div>
                      ) : files.length === 0 ? (
                        <div className="p-4 text-center">
                          <FileText size={24} className="text-gray-300 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">{t('noAttachments')}</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {files.map(a => (
                            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white transition-colors">
                              <FileText size={18} className={getFileIconColor(a.tipo_mime)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{a.nome_originale}</p>
                                <p className="text-[11px] text-gray-400">
                                  {formatFileSize(a.dimensione)} &middot; {new Date(a.created_at).toLocaleDateString(getDateLocale())}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDownload(p.id, a.id, a.nome_originale)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors shrink-0"
                              >
                                <Download size={13} />
                                {t('download')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded blocking email */}
                {isExpanded && hasEmailContent && (
                  <div className="border-t border-orange-200 bg-orange-50/50 px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail size={16} className="text-orange-600" />
                      <span className="text-sm font-semibold text-orange-800">{t('pendingCommunication')}</span>
                    </div>
                    <div className="bg-white rounded-lg border border-orange-200 p-4">
                      <h4 className="font-medium text-gray-900 text-sm">{p.email_bloccante_oggetto}</h4>
                      {p.email_bloccante_data && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('sentOn')} {formatDate(p.email_bloccante_data)}
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
