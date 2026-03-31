import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

export default function HelpTip({ text, size = 14, className = '' }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState('bottom')
  const tipRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      // If too close to bottom, show above
      if (rect.bottom + 80 > window.innerHeight) setPos('top')
      else setPos('bottom')
    }
  }, [show])

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        className="text-purple-400 hover:text-purple-600 transition-colors cursor-help"
      >
        <HelpCircle size={size} />
      </button>
      {show && (
        <div
          ref={tipRef}
          className={`absolute z-50 w-64 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg leading-relaxed ${
            pos === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2`}
        >
          <div className={`absolute w-2 h-2 bg-white border-gray-200 rotate-45 left-1/2 -translate-x-1/2 ${
            pos === 'top' ? 'bottom-[-5px] border-r border-b' : 'top-[-5px] border-l border-t'
          }`} />
          {text}
        </div>
      )}
    </span>
  )
}
