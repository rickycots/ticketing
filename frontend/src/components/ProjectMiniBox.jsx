import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'

const statoColors = {
  chiuso: 'bg-green-100 text-green-800',
  attivo: 'bg-blue-100 text-blue-800',
  bloccato: 'bg-red-100 text-red-800',
  senza_attivita: 'bg-gray-100 text-gray-600',
}

const bloccoColors = {
  lato_cliente: 'bg-orange-50 text-orange-700',
  lato_stm: 'bg-yellow-50 text-yellow-700',
}
const bloccoLabels = {
  lato_cliente: 'Bloccato lato cliente',
  lato_stm: 'Bloccato lato STM',
}

/**
 * ProjectMiniBox — Card progetto per liste
 *
 * Props:
 * - project: oggetto progetto (nome, stato, avanzamento, cliente_nome, num_attivita, data_scadenza, blocco, manutenzione_ordinaria, chat_non_lette, tecnici)
 * - to: link destinazione
 * - isAdmin: mostra tecnici avatars
 * - getTecniciNames: funzione che dato array IDs restituisce array iniziali (opzionale)
 */
export default function ProjectMiniBox({ project: p, to, isAdmin = false, getTecniciNames }) {
  return (
    <Link to={to} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{p.nome}</h3>
          {p.chat_non_lette > 0 && (
            <span className="relative inline-flex items-center" title={`${p.chat_non_lette} messaggi non letti`}>
              <MessageCircle size={16} className="text-blue-500" />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {p.chat_non_lette}
              </span>
            </span>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statoColors[p.stato] || 'bg-gray-100 text-gray-600'}`}>
          {(p.stato || '').replace('_', ' ')}
        </span>
      </div>

      {p.cliente_nome && <p className="text-sm text-gray-500 mb-1">Cliente: {p.cliente_nome}</p>}

      {/* Updated date */}
      {p.updated_at && (
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          <span className="inline-flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${(() => {
              const diff = (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24)
              return diff < 3 ? 'bg-green-500' : diff < 7 ? 'bg-yellow-500' : 'bg-gray-400'
            })()}`} />
            Aggiornato: {new Date(p.updated_at).toLocaleDateString('it-IT')}
          </span>
          {p.data_scadenza && (
            <span className="inline-flex items-center gap-1">
              Completamento previsto: <b className="text-gray-600">{new Date(p.data_scadenza).toLocaleDateString('it-IT')}</b>
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Avanzamento</span>
          <span>{p.avanzamento}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${p.avanzamento === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
            style={{ width: `${p.avanzamento}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
        <span>{p.num_attivita || (p.attivita || []).length} attività</span>
      </div>

      {/* Tecnici avatars + STM badge */}
      {((isAdmin && p.tecnici && p.tecnici.length > 0) || !!p.manutenzione_ordinaria) && (
        <div className="flex items-center gap-1 mt-3">
          {isAdmin && p.tecnici && p.tecnici.length > 0 && getTecniciNames && getTecniciNames(p.tecnici)?.map((initials, i) => (
            <span key={i} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {initials}
            </span>
          ))}
          {!!p.manutenzione_ordinaria && (
            <span className="ml-auto text-xs font-bold text-blue-600">STM Domotica</span>
          )}
        </div>
      )}

      {p.stato_calcolato === 'bloccato' && !bloccoLabels[p.blocco] && (
        <div className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          🚫 Attività Bloccata
        </div>
      )}

      {bloccoLabels[p.blocco] && (
        <div className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-medium ${bloccoColors[p.blocco]}`}>
          {p.blocco === 'lato_cliente' ? '⚠️ ' : '🔧 '}{bloccoLabels[p.blocco]}
        </div>
      )}
    </Link>
  )
}
