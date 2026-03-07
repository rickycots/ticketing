import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, Bot, User, RotateCcw } from 'lucide-react'
import { clientAi } from '../../api/client'
import { t } from '../../i18n/clientTranslations'

export default function AiChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
    function handleNewChat() {
      setMessages([])
      setInput('')
      inputRef.current?.focus()
    }
    window.addEventListener('ai-new-chat', handleNewChat)
    return () => window.removeEventListener('ai-new-chat', handleNewChat)
  }, [])

  async function handleSend(e) {
    e.preventDefault()
    const domanda = input.trim()
    if (!domanda || loading) return

    setMessages(prev => [...prev, { role: 'user', content: domanda }])
    setInput('')
    setLoading(true)

    try {
      const data = await clientAi.ask(domanda)
      setMessages(prev => [...prev, { role: 'assistant', content: data.risposta }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `${t('aiError')}: ${err.message}`, error: true }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Empty state */}
      {messages.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Sparkles size={48} className="mb-4 text-blue-300" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">{t('aiTitle')}</h2>
          <p className="text-sm text-gray-400 text-center max-w-md">{t('aiSubtitle')}</p>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-4 mb-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mt-1">
                  <Bot size={16} className="text-blue-600" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mt-1">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mt-1">
                <Bot size={16} className="text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <Loader2 size={18} className="animate-spin text-blue-500" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        <form onSubmit={handleSend} className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiPlaceholder')}
            disabled={loading}
            rows={4}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 resize-none"
          />
          <div className="flex flex-col gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => { setMessages([]); setInput(''); inputRef.current?.focus(); }}
                className="bg-gray-100 text-gray-600 rounded-xl px-5 py-3 hover:bg-gray-200 transition-colors cursor-pointer text-xs font-medium flex items-center gap-1.5"
                title={t('aiNewChat')}
              >
                <RotateCcw size={14} />
                {t('aiNewChat')}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 text-white rounded-xl px-5 py-3 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
          {t('aiDisclaimer')}
        </p>
      </div>
    </div>
  )
}
