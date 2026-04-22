import { Search, Download, Mail, Phone, Building2, Trash2, Pencil } from 'lucide-react'
import PageGuide, { GuideNumber } from '../PageGuide'

const items = [
  { n: 1, title: 'Ricerca testuale', description: 'Cerca per nome, email, azienda, ruolo, progetto o attività. La ricerca è case-insensitive e si applica dentro ai contesti.' },
  { n: 2, title: 'Filtri tipologia', description: 'Click per mostrare solo: Utenti portale (viola), Referenti interni (teal) o Referenti esterni (ambra). Il numero nel badge mostra il conteggio per ciascun tipo.' },
  { n: 3, title: 'Export CSV', description: 'Scarica la lista corrente (filtrata) come CSV con separatore ";". Contiene tutti i campi inclusi i contesti concatenati.' },
  { n: 4, title: 'Colonna Email', description: 'Email cliccabile (mailto:) sempre su una riga per esteso.' },
  { n: 5, title: 'Colonna TEL', description: 'Icona telefono verde: click per chiamare (tel:), passaggio del mouse per vedere il numero. "—" grigio se assente.' },
  { n: 6, title: 'Colonna Contesto', description: 'Chip con progetto (blu grassetto) + attività (corsivo grigio). Per utenti portale e ref interni senza assegnazioni appare "Non assegnato".' },
  { n: 7, title: 'Colonna Status', description: 'Badge colorato che indica la tipologia: Utente portale / Ref. interno / Ref. esterno.' },
  { n: 8, title: 'Matita (modifica)', description: 'Apre un popup per modificare i dati anagrafici. Per ref esterni multi-contesto la modifica si applica a tutti i record con la stessa email.' },
  { n: 9, title: 'Cestino (elimina)', description: 'Elimina la persona da TUTTI i contesti (con conferma). Per ref interni fa cascata su junction table; per ref esterni elimina tutti i record con la stessa email.' },
  { n: 10, title: 'Paginazione', description: '15 righe per pagina. Il paginator appare solo se i risultati filtrati superano 15. Reset automatico a pagina 1 al cambio di filtro/ricerca.' },
]

const statusConfig = {
  utente_portale: { label: 'Utente portale', color: 'bg-purple-100 text-purple-800' },
  ref_interno: { label: 'Ref. interno', color: 'bg-teal-100 text-teal-800' },
  ref_esterno: { label: 'Ref. esterno', color: 'bg-amber-100 text-amber-800' },
}

export default function AnagraficaGuide({ open, onClose }) {
  return (
    <PageGuide open={open} onClose={onClose} title="Guida: Anagrafica" items={items}>
      <div className="space-y-3">
        {/* Barra filtri mock */}
        <div className="relative">
          <GuideNumber n={1} x={-8} y={-8} />
          <GuideNumber n={2} x={230} y={-8} />
          <GuideNumber n={3} right={-8} y={-8} />
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-[220px]">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <div className="pl-7 pr-2 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-400 bg-white">Cerca nome, email...</div>
            </div>
            <div className="flex gap-1 text-[10px]">
              <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800 font-medium">Tutti</span>
              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Utenti</span>
              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Interni</span>
              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-500">Esterni</span>
            </div>
            <button className="ml-auto inline-flex items-center gap-1 bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1 text-[10px]">
              <Download size={10} /> CSV
            </button>
          </div>
        </div>

        {/* Tabella mock */}
        <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Persona</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Email</th>
                <th className="text-center px-2 py-1.5 font-semibold text-gray-500">TEL</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Azienda</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Contesto</th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 align-top relative">
                <td className="px-2 py-2 font-medium text-gray-800">Mario Rossi</td>
                <td className="px-2 py-2 relative">
                  <GuideNumber n={4} x={-5} y={-2} />
                  <span className="inline-flex items-center gap-1 text-blue-600"><Mail size={10} /> m.rossi@acme.it</span>
                </td>
                <td className="px-2 py-2 text-center relative">
                  <GuideNumber n={5} x={-5} y={-2} />
                  <Phone size={12} className="text-green-600 inline" />
                </td>
                <td className="px-2 py-2 text-gray-600"><Building2 size={10} className="inline text-gray-400" /> ACME</td>
                <td className="px-2 py-2 relative">
                  <GuideNumber n={6} x={-5} y={-2} />
                  <span className="inline-flex items-baseline gap-1 bg-blue-50 text-[10px] px-1.5 py-0.5 rounded-full">
                    <span className="text-blue-700 font-medium">Progetto X</span>
                    <span className="italic text-gray-500">· Att. 1</span>
                  </span>
                </td>
                <td className="px-2 py-2 relative">
                  <GuideNumber n={7} x={-5} y={-2} />
                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusConfig.ref_esterno.color}`}>Ref. esterno</span>
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap relative">
                  <GuideNumber n={8} x={-5} y={-4} />
                  <GuideNumber n={9} right={-8} y={-4} />
                  <Pencil size={12} className="inline text-gray-400 mr-1" />
                  <Trash2 size={12} className="inline text-gray-400" />
                </td>
              </tr>
              <tr>
                <td className="px-2 py-2 font-medium text-gray-800">Anna Bianchi</td>
                <td className="px-2 py-2"><span className="inline-flex items-center gap-1 text-blue-600"><Mail size={10} /> a.bianchi@rossi.it</span></td>
                <td className="px-2 py-2 text-center"><span className="text-gray-300">—</span></td>
                <td className="px-2 py-2 text-gray-600"><Building2 size={10} className="inline text-gray-400" /> Rossi Srl</td>
                <td className="px-2 py-2"><span className="text-[10px] text-gray-400 italic">Non assegnato</span></td>
                <td className="px-2 py-2"><span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusConfig.utente_portale.color}`}>Utente portale</span></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Paginazione mock */}
        <div className="relative flex items-center justify-between px-2 py-2 border-t border-gray-200 text-[10px]">
          <GuideNumber n={10} x={-8} y={-2} />
          <span className="text-gray-500">Mostra 1-15 di 42</span>
          <div className="flex gap-1">
            <span className="px-2 py-0.5 rounded bg-blue-600 text-white">1</span>
            <span className="px-2 py-0.5 rounded text-gray-600">2</span>
            <span className="px-2 py-0.5 rounded text-gray-600">3</span>
          </div>
        </div>
      </div>
    </PageGuide>
  )
}
