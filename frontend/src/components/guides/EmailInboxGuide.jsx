import { Mail, MailOpen, AlertTriangle, Star, Info, Reply, Ticket as TicketIcon } from 'lucide-react'
import PageGuide, { GuideNumber } from '../PageGuide'

const items = [
  { n: 1, title: 'Filtri rapidi (pills)', description: 'Tutte / Da leggere / Non assegnate / Bloccanti / Rilevanti. Ciascuna mostra il conteggio corrispondente.' },
  { n: 2, title: 'Filtri strutturati', description: 'Filtra per Direzione (Ricevute/Inviate), Cliente, Progetto e Attività. Selezionando un cliente si popola il menu dei suoi progetti.' },
  { n: 3, title: 'Lista email (card)', description: 'Ogni card mostra: icona lettura, direzione (ricevuta/inviata), flag bloccante/rilevante/di-contesto, oggetto, mittente e data.' },
  { n: 4, title: 'Icona lettura', description: 'Cerchio blu pieno (Mail) = non letta. Cerchio grigio vuoto (MailOpen) = già letta.' },
  { n: 5, title: 'Badge direzione', description: 'Viola = Ricevuta, Verde = Inviata.' },
  { n: 6, title: 'Flag rilevanza/blocco', description: '⚠ arancione = Bloccante (ferma il progetto); ⭐ viola = Rilevante; ℹ grigio = Di contesto.' },
  { n: 7, title: 'Pulsanti Rispondi / Rispondi a tutti', description: 'La risposta viene inviata da ticketing@ con tag [TICKET #TK-...] per essere auto-agganciata al thread.' },
  { n: 8, title: 'Crea Ticket da email', description: 'Disponibile sotto la select Cliente (disabilitato finché un cliente non è selezionato). Crea un nuovo ticket usando questa email come primo messaggio. Auto-reply automatica al mittente. Se il mittente non è utente portale del cliente, chiede a chi notificare.' },
  { n: 9, title: 'Assegnazioni', description: 'Associa la mail a un cliente, progetto e attività. Utile per raggruppare in contesto.' },
  { n: 10, title: 'Per inviare una nuova email', description: 'Usa il link "Invia Mail" nella sidebar (non più in questa pagina).' },
]

export default function EmailInboxGuide({ open, onClose }) {
  return (
    <PageGuide open={open} onClose={onClose} title="Guida: Email Inbox" items={items}>
      <div className="space-y-3">
        {/* Toolbar filtri */}
        <div className="relative">
          <GuideNumber n={2} x={-8} y={-8} />
          <div className="flex gap-2 items-center flex-wrap text-[10px]">
            <span className="px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-500">Direzione</span>
            <span className="px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-500">Cliente</span>
            <span className="px-2 py-1 rounded-lg border border-gray-300 bg-white text-gray-500">Progetto</span>
          </div>
        </div>

        {/* Pills filtri rapidi */}
        <div className="relative">
          <GuideNumber n={1} x={-8} y={-8} />
          <div className="flex gap-1 text-[10px]">
            <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800 font-medium">Tutte <span className="ml-0.5 bg-blue-200 px-1 rounded">42</span></span>
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Da leggere <span className="ml-0.5 bg-gray-200 px-1 rounded">5</span></span>
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Bloccanti <span className="ml-0.5 bg-gray-200 px-1 rounded">2</span></span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {/* Lista email mock */}
          <div className="col-span-2 relative bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            <GuideNumber n={3} x={-8} y={6} />
            <div className="p-2 bg-blue-50/50 relative">
              <GuideNumber n={4} x={-3} y={2} />
              <GuideNumber n={5} x={22} y={2} />
              <GuideNumber n={6} x={90} y={2} />
              <div className="flex items-center gap-1 mb-1">
                <Mail size={10} className="text-blue-500" />
                <span className="inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-purple-100 text-purple-800">Ricevuta</span>
                <AlertTriangle size={10} className="text-orange-500" />
                <Star size={10} className="text-purple-500" />
              </div>
              <p className="text-[11px] font-semibold truncate">Problema urgente</p>
              <p className="text-[10px] text-gray-400 truncate">Da: cliente@azienda.it</p>
            </div>
            <div className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <MailOpen size={10} className="text-gray-400" />
                <span className="inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-green-100 text-green-800">Inviata</span>
                <Info size={10} className="text-slate-400" />
              </div>
              <p className="text-[11px] font-medium truncate">Re: Richiesta info</p>
              <p className="text-[10px] text-gray-400 truncate">Da: ticketing@stmdomotica.it</p>
            </div>
          </div>

          {/* Pannello dettaglio */}
          <div className="col-span-3 relative bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-sm font-semibold mb-2">Oggetto email selezionata</p>
            <div className="flex gap-1 mb-2 flex-wrap relative">
              <GuideNumber n={7} x={-8} y={-3} />
              <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border bg-blue-50 text-blue-700 border-blue-200">
                <Reply size={10} /> Rispondi
              </button>
              <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                <Reply size={10} /> Rispondi a tutti
              </button>
            </div>
            <div className="relative mt-2">
              <GuideNumber n={8} x={-8} y={-3} />
              <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-orange-600 text-white">
                <TicketIcon size={10} /> Crea Ticket da questa email
              </button>
            </div>
            <div className="relative mt-3 border-t border-gray-100 pt-2">
              <GuideNumber n={9} x={-8} y={-3} />
              <p className="text-[10px] text-gray-500">Cliente / Progetto / Attività — select di assegnazione</p>
              <div className="h-5 mt-1 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </PageGuide>
  )
}
