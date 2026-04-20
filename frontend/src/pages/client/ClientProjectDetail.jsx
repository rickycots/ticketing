import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Mail, CheckCircle2, Clock, Wrench, Lock, CalendarClock, ChevronRight, ChevronDown, Paperclip, FileText, Download, Users, Star, Info } from 'lucide-react'
import { clientProjects } from '../../api/client'
import ProjectDataBox from '../../components/ProjectDataBox'
import EmailBody from '../../components/EmailBody'
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

export default function ClientProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [expandedAllegati, setExpandedAllegati] = useState(false)
  const [expandedEmails, setExpandedEmails] = useState({})
  const [expandedReferenti, setExpandedReferenti] = useState(false)
  const [emailSort, setEmailSort] = useState('ultime')
  const [emailDir, setEmailDir] = useState('tutte')
  const [allegatiData, setAllegatiData] = useState([])
  const [loadingAllegati, setLoadingAllegati] = useState(false)
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
  const isManutenzione = !!project.manutenzione_ordinaria

  function loadAllegati() {
    if (allegatiData.length > 0) return
    setLoadingAllegati(true)
    clientProjects.allegati(clienteId, id)
      .then(data => setAllegatiData(data || []))
      .catch(console.error)
      .finally(() => setLoadingAllegati(false))
  }

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
                <div className="border-t border-gray-100 pt-3 mt-2">
                  <EmailBody corpo={project.email_bloccante_corpo} className="leading-relaxed" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Box Dati Progetto */}
      <div className="space-y-4 mb-5">
      <ProjectDataBox
        project={project}
        isAdmin={false}
        allegati={allegatiData}
        showAllegati={expandedAllegati}
        onToggleAllegati={() => {
          const next = !expandedAllegati
          setExpandedAllegati(next)
          if (next) loadAllegati()
        }}
      />
      </div>



      {/* Email list */}
      {(() => {
        const allEmails = project.emails || []
        const daAssistenza = allEmails.filter(e => e.direzione === 'inviata')
        const daAzienda = allEmails.filter(e => e.direzione !== 'inviata')
        const base = emailDir === 'assistenza' ? daAssistenza : emailDir === 'azienda' ? daAzienda : allEmails
        const sorted = [...base].sort((a, b) => {
          const da = new Date(a.data_ricezione).getTime()
          const db = new Date(b.data_ricezione).getTime()
          return emailSort === 'ultime' ? db - da : da - db
        })
        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <Mail size={18} className="text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Email Progetto</h2>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full px-1.5 py-0.5">{allEmails.length}</span>
            </div>
            {allEmails.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 mr-1">Ordine:</span>
                {[
                  { key: 'ultime', label: 'Ultime prima' },
                  { key: 'prime', label: 'Prime prima' },
                ].map(o => (
                  <button key={o.key} onClick={() => setEmailSort(o.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      emailSort === o.key ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>{o.label}</button>
                ))}
                <span className="text-xs font-medium text-gray-500 ml-3 mr-1">Direzione:</span>
                {[
                  { key: 'tutte', label: 'Tutte', count: allEmails.length, active: 'bg-blue-100 text-blue-800', counter: 'bg-blue-200' },
                  { key: 'assistenza', label: 'Da Assistenza', count: daAssistenza.length, active: 'bg-purple-100 text-purple-800', counter: 'bg-purple-200' },
                  { key: 'azienda', label: 'Dalla tua Azienda', count: daAzienda.length, active: 'bg-teal-100 text-teal-800', counter: 'bg-teal-200' },
                ].map(f => (
                  <button key={f.key} onClick={() => setEmailDir(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      emailDir === f.key ? f.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {f.label} <span className={`ml-1 px-1 py-0.5 rounded text-xs ${emailDir === f.key ? f.counter : 'bg-gray-200'}`}>{f.count}</span>
                  </button>
                ))}
              </div>
            )}
            {sorted.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Nessuna email in questa categoria</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sorted.map(e => (
                  <div key={e.id} className={`p-4 ${!!e.is_bloccante ? 'bg-orange-50/50 border-l-4 border-l-orange-400' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedEmails(prev => ({ ...prev, [e.id]: !prev[e.id] }))} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                          {expandedEmails[e.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <p className="text-sm font-medium">
                          {e.oggetto}
                          {e.direzione === 'inviata' ? (
                            <span className="ml-2 text-xs text-purple-600 font-medium">DA ASSISTENZA</span>
                          ) : (
                            <span className="ml-2 text-xs text-teal-600 font-medium">DALLA TUA AZIENDA</span>
                          )}
                          {!!e.is_bloccante && <span className="ml-2 text-xs text-orange-600 font-medium">BLOCCANTE</span>}
                          {e.rilevanza === 'rilevante' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-purple-600 font-medium"><Star size={11} /> RILEVANTE</span>}
                          {e.rilevanza === 'di_contesto' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-500 font-medium"><Info size={11} /> DI CONTESTO</span>}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">{new Date(e.data_ricezione).toLocaleString(getDateLocale())}</p>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">{e.mittente}</p>
                    {expandedEmails[e.id] && e.corpo && (
                      <div className="mt-2 ml-6 p-3 bg-gray-50 rounded-lg">
                        <EmailBody corpo={e.corpo} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
