import DOMPurify from 'dompurify'

function looksLikeHtml(s) {
  if (typeof s !== 'string') return false
  if (/<\/?[a-z][\w-]*(\s[^>]*)?\/?>/i.test(s)) return true
  if (/&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i.test(s)) return true
  return false
}

function preprocessHtml(html) {
  let out = String(html)
  out = out.replace(/<!DOCTYPE[^>]*>/gi, '')
  out = out.replace(/<\?xml[^>]*\?>/gi, '')
  out = out.replace(/<meta[^>]*>/gi, '')
  out = out.replace(/<link[^>]*>/gi, '')
  out = out.replace(/<head[\s\S]*?<\/head>/gi, '')
  out = out.replace(/<\/?html[^>]*>/gi, '')
  out = out.replace(/<\/?body[^>]*>/gi, '')
  return out.trim()
}

// Individua i marker di risposta/inoltro e spezza il corpo plaintext in segmenti
function splitReplyChain(text) {
  const regex = /(?:^Il [^\n]{1,300}?ha scritto:?\s*$|^On [^\n]{1,300}?wrote:?\s*$|^-{2,}\s*(?:Messaggio originale|Original Message|Inoltrato|Forwarded Message|Messaggio inoltrato)\s*-{2,}\s*$|(?:^(?:Da|From|A|To|Cc|Bcc|Ccn|Oggetto|Subject|Inviato|Sent|Data|Date):\s[^\n]+(?:\r?\n|$)){3,})/gim
  const segments = []
  let lastIdx = 0
  let lastLabel = null
  let m
  while ((m = regex.exec(text)) !== null) {
    const chunk = text.slice(lastIdx, m.index)
    if (chunk.trim() || lastLabel) segments.push({ label: lastLabel, text: chunk.replace(/\s+$/, '') })
    lastLabel = m[0].trim()
    lastIdx = m.index + m[0].length
  }
  const tail = text.slice(lastIdx)
  if (tail.trim() || lastLabel) segments.push({ label: lastLabel, text: tail.replace(/^\s+/, '') })
  if (segments.length === 0) return [{ label: null, text }]
  return segments
}

function PlaintextBody({ corpo, className }) {
  const segments = splitReplyChain(corpo)
  if (segments.length <= 1) {
    return <div className={`text-sm text-gray-700 whitespace-pre-wrap break-words ${className}`}>{corpo}</div>
  }
  return (
    <div className={`text-sm text-gray-700 ${className}`}>
      {segments.map((s, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 border-t border-gray-300" />
              <span className="text-[11px] text-gray-400 italic">Messaggio precedente</span>
              <div className="flex-1 border-t border-gray-300" />
            </div>
          )}
          {s.label && (
            <div className="text-[11px] text-gray-500 italic mb-1 whitespace-pre-wrap break-words">{s.label}</div>
          )}
          {s.text && (
            <div className={`whitespace-pre-wrap break-words ${i > 0 ? 'pl-3 border-l-2 border-gray-200 text-gray-600' : ''}`}>
              {s.text}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function EmailBody({ corpo, className = '' }) {
  if (!corpo) return null
  if (looksLikeHtml(corpo)) {
    const pre = preprocessHtml(corpo)
    const clean = DOMPurify.sanitize(pre, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'meta', 'link', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    })
    return (
      <div className="email-body-scroll">
        <div className={`email-body-html text-sm text-gray-700 ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />
      </div>
    )
  }
  return <PlaintextBody corpo={corpo} className={className} />
}
