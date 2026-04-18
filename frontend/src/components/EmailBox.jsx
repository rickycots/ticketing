import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Star, Info, ExternalLink } from 'lucide-react'
import DOMPurify from 'dompurify'

function looksLikeHtml(s) {
  return typeof s === 'string' && /<\/?(p|div|br|span|strong|em|mark|b|i|u|a|ul|ol|li|h[1-6]|table|tr|td|th|img|blockquote|pre|code)\b/i.test(s)
}

function renderBody(corpo) {
  if (!corpo) return null
  if (looksLikeHtml(corpo)) {
    const clean = DOMPurify.sanitize(corpo, { FORBID_TAGS: ['script', 'style', 'iframe'], FORBID_ATTR: ['onerror', 'onload', 'onclick'] })
    return <div className="email-body-html text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: clean }} />
  }
  return <div className="text-sm text-gray-700 whitespace-pre-wrap">{corpo}</div>
}

export default function EmailBox({
  emails = [],
  direction = 'ricevute',
  onDirectionChange,
  filter = 'tutte',
  onFilterChange,
  expandedEmails = {},
  onToggleExpand,
  threadUrl,
  showActivityInfo = false,
}) {
  const ricevute = emails.filter(e => e.direzione !== 'inviata')
  const inviate = emails.filter(e => e.direzione === 'inviata')
  const dirEmails = direction === 'inviate' ? inviate : ricevute

  const filtered = filter === 'rilevanti' ? dirEmails.filter(e => e.rilevanza === 'rilevante')
    : filter === 'di_contesto' ? dirEmails.filter(e => e.rilevanza === 'di_contesto')
    : filter === 'bloccanti' ? dirEmails.filter(e => e.is_bloccante)
    : dirEmails

  return (
    <>
      <div className="flex border-b border-gray-100">
        {[
          { key: 'ricevute', label: 'In arrivo', count: ricevute.length },
          { key: 'inviate', label: 'Inviate', count: inviate.length },
        ].map(d => (
          <button key={d.key}
            onClick={() => { onDirectionChange?.(d.key); onFilterChange?.('tutte') }}
            className={`flex-1 px-3 py-2.5 text-sm font-medium text-center cursor-pointer transition-colors ${
              direction === d.key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {d.label} <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{d.count}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1 px-4 pt-3 pb-2">
        {[
          { key: 'tutte', label: 'Tutte', count: dirEmails.length, active: 'bg-blue-100 text-blue-800', counter: 'bg-blue-200' },
          { key: 'rilevanti', label: 'Rilevanti', count: dirEmails.filter(e => e.rilevanza === 'rilevante').length, active: 'bg-purple-100 text-purple-800', counter: 'bg-purple-200' },
          { key: 'di_contesto', label: 'Di contesto', count: dirEmails.filter(e => e.rilevanza === 'di_contesto').length, active: 'bg-slate-200 text-slate-800', counter: 'bg-slate-300' },
          { key: 'bloccanti', label: 'Bloccanti', count: dirEmails.filter(e => e.is_bloccante).length, active: 'bg-orange-100 text-orange-800', counter: 'bg-orange-200' },
        ].map(f => (
          <button key={f.key}
            onClick={() => onFilterChange?.(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === f.key ? f.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {f.label} <span className={`ml-1 px-1 py-0.5 rounded text-xs ${filter === f.key ? f.counter : 'bg-gray-200'}`}>{f.count}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="p-4 text-sm text-gray-400">Nessuna email in questa categoria</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map(e => {
            const url = threadUrl ? threadUrl(e) : null
            return (
              <div key={e.id} className={`p-4 ${e.is_bloccante ? 'bg-orange-50/50 border-l-4 border-l-orange-400' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onToggleExpand?.(e.id)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                      {expandedEmails[e.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <p className="text-sm font-medium">
                      {e.oggetto}
                      {e.is_bloccante && <span className="ml-2 text-xs text-orange-600 font-medium">BLOCCANTE</span>}
                      {e.rilevanza === 'rilevante' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-purple-600 font-medium"><Star size={11} /> RILEVANTE</span>}
                      {e.rilevanza === 'di_contesto' && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-slate-500 font-medium"><Info size={11} /> DI CONTESTO</span>}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(e.data_ricezione).toLocaleString('it-IT')}</p>
                </div>
                <p className="text-xs text-gray-500 ml-6">{e.mittente} → {e.destinatario}</p>
                {showActivityInfo && e.attivita_nome && (
                  <p className="text-xs text-orange-600 font-medium ml-6 mt-1">Attività: {e.attivita_nome}</p>
                )}
                {url && e.thread_count > 1 && (
                  <Link to={url} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-6 mt-1">
                    <ExternalLink size={12} /> Vai al thread ({e.thread_count} messaggi)
                  </Link>
                )}
                {expandedEmails[e.id] && e.corpo && (
                  <div className="mt-2 ml-6 p-3 bg-gray-50 rounded-lg">
                    {renderBody(e.corpo)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
