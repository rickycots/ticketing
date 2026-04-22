import { useEffect } from 'react'
import { X, BookOpen } from 'lucide-react'

/**
 * PageGuide — Drawer lateral per la guida di una pagina.
 *
 * Props:
 * - open: boolean — apertura drawer
 * - onClose: callback
 * - title: string — titolo della guida
 * - children: JSX dello "screenshot annotato" (card con numeri sovrapposti)
 * - items: array [{ n, title, description }] — legenda numerata
 */
export default function PageGuide({ open, onClose, title = 'Guida pagina', children, items = [] }) {
  useEffect(() => {
    function onEsc(e) { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[560px] bg-white shadow-2xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-semibold text-sm inline-flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" /> {title}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 cursor-pointer" title="Chiudi (ESC)">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Screenshot annotato */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            {children}
          </div>

          {/* Legenda */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Legenda</p>
            <ul className="space-y-2">
              {items.map(it => (
                <li key={it.n} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {it.n}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{it.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{it.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * GuideNumber — Pallino numerato rosso posizionato in absolute
 * da usare dentro "screenshot annotato" con offsetX/offsetY in px
 */
export function GuideNumber({ n, x, y, right, bottom }) {
  const style = {}
  if (x !== undefined) style.left = x
  if (y !== undefined) style.top = y
  if (right !== undefined) style.right = right
  if (bottom !== undefined) style.bottom = bottom
  return (
    <span
      className="absolute z-10 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white"
      style={style}
    >
      {n}
    </span>
  )
}
