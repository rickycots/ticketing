import PageGuide, { GuideNumber } from '../PageGuide'

const items = [
  { n: 1, title: 'Filtri stato', description: 'Apert* / In lavorazione / Chiusi. Il contatore mostra quanti ticket appartengono a ciascuno stato.' },
  { n: 2, title: 'Ricerca testuale', description: 'Cerca per codice, oggetto, cliente o email creatore.' },
  { n: 3, title: 'Riga ticket', description: 'Click sulla riga per aprire il dettaglio con thread email e azioni.' },
  { n: 4, title: 'Codice ticket', description: 'Formato TK-YYYY-NNNN progressivo. Il codice è la chiave univoca usata nei subject email (tag [TICKET #...]).' },
  { n: 5, title: 'Priorità', description: 'Alta (rosso) / Media (giallo) / Bassa (grigio). Impostata alla creazione, modificabile in seguito.' },
  { n: 6, title: 'Cliente', description: 'Azienda a cui appartiene il ticket.' },
  { n: 7, title: 'Data evasione (SLA)', description: 'Data limite per la prima risposta in base allo SLA del cliente (1g / 3g / nb).' },
  { n: 8, title: 'Assegnato a', description: 'Tecnico o admin in carico. Se vuoto = non assegnato.' },
]

const statoColors = {
  aperto: 'bg-blue-100 text-blue-800',
  in_lavorazione: 'bg-yellow-100 text-yellow-800',
  chiuso: 'bg-green-100 text-green-800',
}

export default function TicketListGuide({ open, onClose }) {
  return (
    <PageGuide open={open} onClose={onClose} title="Guida: Ticket" items={items}>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="relative flex gap-2 items-center">
          <GuideNumber n={1} x={-8} y={-8} />
          <GuideNumber n={2} right={-8} y={-8} />
          <div className="flex gap-1 text-[10px]">
            <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800 font-medium">Aperti <span className="ml-0.5 bg-blue-200 px-1 rounded">3</span></span>
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">In lavorazione <span className="ml-0.5 bg-gray-200 px-1 rounded">5</span></span>
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Chiusi <span className="ml-0.5 bg-gray-200 px-1 rounded">12</span></span>
          </div>
          <div className="ml-auto px-2 py-1 rounded-lg border border-gray-300 bg-white text-[10px] text-gray-400">Cerca...</div>
        </div>

        {/* Tabella ticket mock */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Codice</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Oggetto</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Stato</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Priorità</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Cliente</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">SLA</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Assegnato</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 relative">
                <GuideNumber n={3} x={-10} y={2} />
                <td className="px-2 py-2 relative">
                  <GuideNumber n={4} x={-5} y={-2} />
                  <span className="font-mono text-blue-700 font-medium">TK-2026-0042</span>
                </td>
                <td className="px-2 py-2 text-gray-700 truncate max-w-[120px]">Problema router</td>
                <td className="px-2 py-2"><span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statoColors.aperto}`}>Aperto</span></td>
                <td className="px-2 py-2 relative">
                  <GuideNumber n={5} x={-5} y={-2} />
                  <span className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">Alta</span>
                </td>
                <td className="px-2 py-2 text-gray-600 relative">
                  <GuideNumber n={6} x={-5} y={-2} />
                  ACME Srl
                </td>
                <td className="px-2 py-2 text-gray-600 relative">
                  <GuideNumber n={7} x={-5} y={-2} />
                  23/04/2026
                </td>
                <td className="px-2 py-2 text-gray-600 relative">
                  <GuideNumber n={8} x={-5} y={-2} />
                  Riccardo C.
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-mono text-blue-700">TK-2026-0041</td>
                <td className="px-2 py-2 text-gray-700 truncate max-w-[120px]">Richiesta info</td>
                <td className="px-2 py-2"><span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statoColors.chiuso}`}>Chiuso</span></td>
                <td className="px-2 py-2"><span className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700">Media</span></td>
                <td className="px-2 py-2 text-gray-600">Rossi Srl</td>
                <td className="px-2 py-2 text-gray-400">—</td>
                <td className="px-2 py-2 text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageGuide>
  )
}
