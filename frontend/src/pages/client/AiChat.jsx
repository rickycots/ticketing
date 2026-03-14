import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, Bot, User, RotateCcw, BookOpen, MessageSquare, Zap, Shield } from 'lucide-react'
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
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-6" style={{ minHeight: 800 }}>
      {/* Sidebar: Presentazione servizio */}
      <aside className="hidden lg:flex flex-col gap-4">
        {/* AI Info Card */}
        <div className="bg-gradient-to-b from-blue-50 to-white rounded-xl border border-blue-200 shadow-sm p-5 text-center">
          <div className="bg-blue-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={28} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 mb-2">{t('aiTitle')}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('aiSubtitle')}</p>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="bg-emerald-50 rounded-lg p-1.5 flex-shrink-0">
              <BookOpen size={14} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{t('aiFeatureDocs')}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">{t('aiFeatureDocsDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="bg-purple-50 rounded-lg p-1.5 flex-shrink-0">
              <MessageSquare size={14} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{t('aiFeatureMultilang')}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">{t('aiFeatureMultilangDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="bg-amber-50 rounded-lg p-1.5 flex-shrink-0">
              <Zap size={14} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{t('aiFeatureFast')}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">{t('aiFeatureFastDesc')}</p>
            </div>
          </div>
        </div>

        {/* Powered by */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Powered by</p>
          <p className="text-sm font-bold text-gray-600">STM Domotica AI</p>
          <p className="text-[10px] text-gray-400 mt-1">LLM + Knowledge Base</p>
        </div>
      </aside>

      {/* Main: AI Chat (spans 2 columns) */}
      <div className="lg:col-span-2">
        {/* Logo + Input centered when no messages */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center pt-12">
            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
              <Sparkles size={32} className="text-blue-600" />
            </div>
            <div className="w-full max-w-xl">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                <form onSubmit={handleSend} className="flex gap-3 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('aiPlaceholder')}
                    disabled={loading}
                    rows={5}
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="bg-blue-600 text-white rounded-xl px-5 py-3 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send size={18} />
                  </button>
                </form>
                <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
                  {t('aiDisclaimer')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages + Input when chatting */}
        {(messages.length > 0 || loading) && (
          <>
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

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <form onSubmit={handleSend} className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('aiPlaceholder')}
                  disabled={loading}
                  rows={5}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 resize-none"
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => { setMessages([]); setInput(''); inputRef.current?.focus(); }}
                    className="bg-gray-100 text-gray-600 rounded-xl px-5 py-3 hover:bg-gray-200 transition-colors cursor-pointer text-xs font-medium flex items-center gap-1.5"
                    title={t('aiNewChat')}
                  >
                    <RotateCcw size={14} />
                    {t('aiNewChat')}
                  </button>
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
          </>
        )}
        {/* Nota sicurezza sotto la chat */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-amber-600" />
            <h4 className="text-xs font-bold text-amber-800">{t('aiSecurityTitle') || 'Sicurezza'}</h4>
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            {t('aiSecurityDesc') || "I contenuti dei documenti vengono sanitizzati prima dell'invio al modello AI (anti prompt-injection). L'AI non rivela mai configurazione interna, credenziali o schema DB."}
          </p>
        </div>
      </div>
    </div>
  )
}
