import { Pencil, Trash2, FileText, Paperclip, UserCog, Users, UserPlus, ChevronRight } from 'lucide-react'
import PageGuide, { GuideNumber } from '../PageGuide'

const items = [
  { n: 1, title: 'Nome attività + azioni', description: 'Nome dell\'attività con matita (modifica) e cestino (elimina, admin only).' },
  { n: 2, title: 'Badge priorità + stato', description: 'Priorità (alta/media/bassa) e stato (da_fare / in_corso / completata / bloccata). Il bordo sinistro colorato riflette lo stato.' },
  { n: 3, title: 'Barra di avanzamento', description: 'Percentuale di completamento dell\'attività (0-100%). Modificabile da edit.' },
  { n: 4, title: 'Date', description: 'Data inizio, scadenza, completamento. Se scadenza passata senza completamento le date diventano rosse.' },
  { n: 5, title: 'Toggle Descrizione', description: 'Apre il testo esteso della descrizione attività.' },
  { n: 6, title: 'Toggle Allegati', description: 'Upload drag-drop + lista file con download/elimina.' },
  { n: 7, title: 'Toggle Tecnici', description: 'Tecnici assegnati a questa attività specifica.' },
  { n: 8, title: 'Toggle Referenti', description: 'Referenti interni del cliente collegati all\'attività (aggiunta/rimozione anagrafica).' },
  { n: 9, title: 'Toggle Ref. Esterni', description: 'Contatti esterni (terze parti, non del cliente) legati all\'attività. Con form per aggiungere nuovo referente esterno.' },
  { n: 10, title: 'Toggle Dipendenze', description: 'Attività padre (da cui dipende) e attività figlie (che dipendono da questa).' },
  { n: 11, title: 'Stato Attiva / Completata', description: 'Click sul bottone per passare rapidamente tra stati (Attiva → Completata; se bloccata mostra lucchetto non-cliccabile).' },
]

const badgeCls = 'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium'

export default function ActivityDetailGuide({ open, onClose }) {
  return (
    <PageGuide open={open} onClose={onClose} title="Guida: Dettaglio Attività" items={items}>
      <div className="space-y-3">
        {/* Header attività */}
        <div className="relative bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-500 shadow-sm p-4">
          <GuideNumber n={1} x={-8} y={12} />
          <GuideNumber n={2} right={-8} y={12} />
          <GuideNumber n={3} x={-8} y={68} />
          <GuideNumber n={4} x={-8} y={110} />

          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold">Nome Attività</h1>
              <Pencil size={12} className="text-gray-400" />
              <Trash2 size={12} className="text-gray-400" />
            </div>
            <div className="flex gap-1 shrink-0">
              <span className={`${badgeCls} bg-yellow-100 text-yellow-700`}>media</span>
              <span className={`${badgeCls} bg-blue-100 text-blue-700`}>In corso</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '45%' }} />
            </div>
            <span className="text-[10px] font-semibold text-gray-700">45%</span>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            <span>Inizio: <b className="text-gray-700">10/04/2026</b></span>
            <span>Scadenza: <b className="text-gray-700">30/04/2026</b></span>
          </div>
        </div>

        {/* Toggle buttons row */}
        <div className="relative bg-white rounded-xl border border-gray-200 p-3">
          <GuideNumber n={5} x={-8} y={8} />
          <GuideNumber n={6} x={72} y={8} />
          <GuideNumber n={7} x={170} y={8} />
          <GuideNumber n={8} x={240} y={8} />
          <GuideNumber n={9} x={310} y={8} />
          <GuideNumber n={10} right={-8} y={8} />

          <div className="flex items-center gap-3 flex-wrap">
            <button className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              <ChevronRight size={10} /><FileText size={10} /> Descrizione
            </button>
            <button className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              <Paperclip size={10} /> Allegati <span className="bg-blue-100 text-blue-700 px-1 rounded">2</span>
            </button>
            <button className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              <ChevronRight size={10} /><UserCog size={10} /> Tecnici <span className="bg-indigo-100 text-indigo-700 px-1 rounded">1</span>
            </button>
            <button className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              <ChevronRight size={10} /><Users size={10} /> Referenti <span className="bg-teal-100 text-teal-700 px-1 rounded">2</span>
            </button>
            <button className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              <ChevronRight size={10} /><UserPlus size={10} /> Ref. Esterni <span className="bg-amber-100 text-amber-700 px-1 rounded">1</span>
            </button>
          </div>
        </div>

        {/* Sidebar stato mock */}
        <div className="relative bg-white rounded-xl border border-gray-200 p-3">
          <GuideNumber n={11} x={-8} y={8} />
          <p className="text-[10px] text-gray-500 mb-1 font-medium">Stato</p>
          <button className="w-full text-left text-[10px] px-2 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200">
            Stato Attiva: Clicca per Completare
          </button>
        </div>
      </div>
    </PageGuide>
  )
}
