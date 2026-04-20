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
  return <div className={`text-sm text-gray-700 whitespace-pre-wrap break-words ${className}`}>{corpo}</div>
}
