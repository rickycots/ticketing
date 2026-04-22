import { MessageCircle, Bell } from 'lucide-react'
import PageGuide, { GuideNumber } from '../PageGuide'

const items = [
  { n: 1, title: 'Nome progetto', description: 'Clicca la card per aprire il dettaglio del progetto.' },
  { n: 2, title: 'Badge Chat (cerchio blu con contatore rosso)', description: 'Messaggi nella chat del progetto non ancora letti da te. Si aggiorna in tempo reale.' },
  { n: 3, title: 'Badge UPD (arancione)', description: 'Nuove email o note (progetto + attività) dall\'ultima tua visita al ProjectDetail. Si azzera automaticamente all\'apertura del progetto.' },
  { n: 4, title: 'Stato progetto', description: 'Attivo / Chiuso / Bloccato / Senza attività. Calcolato automaticamente dallo stato delle attività: chiuso se tutte completate, bloccato se almeno una è bloccata.' },
  { n: 5, title: 'Cliente', description: 'Azienda cliente a cui appartiene il progetto.' },
  { n: 6, title: 'Pallino colore + data "Aggiornato"', description: 'Data dell\'ultima modifica al record progetto (updated_at: cambia solo per modifiche a stato, blocco, dati o tecnici). Colori: verde <3gg, giallo 3-7gg, grigio >7gg. Per nuove email/note vedi il badge UPD (n. 3).' },
  { n: 7, title: 'Completamento previsto', description: 'Data di scadenza pianificata per la chiusura del progetto.' },
  { n: 8, title: 'Barra di avanzamento', description: 'Media dell\'avanzamento di tutte le attività. Diventa verde al 100%.' },
  { n: 9, title: 'Numero attività', description: 'Conteggio totale delle attività associate al progetto.' },
  { n: 10, title: 'Tecnici assegnati', description: 'Iniziali dei tecnici assegnati al progetto (solo vista admin). Utile per vedere chi ci sta lavorando.' },
  { n: 11, title: 'Banner blocco', description: 'Appare se il progetto è bloccato. "Lato cliente" = in attesa di risposta/azione del cliente; "Lato STM" = bloccato internamente; "Attività Bloccata" = un\'attività singola è bloccata (da email o nota bloccante).' },
]

export default function ProjectListGuide({ open, onClose }) {
  return (
    <PageGuide open={open} onClose={onClose} title="Guida: Lista Progetti" items={items}>
      {/* Mock ProjectMiniBox annotato */}
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-5 pr-8">
        <GuideNumber n={1} x={-8} y={12} />
        <GuideNumber n={2} x={160} y={14} />
        <GuideNumber n={3} x={200} y={14} />
        <GuideNumber n={4} right={-8} y={12} />
        <GuideNumber n={5} x={-8} y={62} />
        <GuideNumber n={6} x={-8} y={92} />
        <GuideNumber n={7} x={240} y={92} />
        <GuideNumber n={8} x={-8} y={136} />
        <GuideNumber n={9} x={-8} y={200} />
        <GuideNumber n={10} x={-8} y={234} />
        <GuideNumber n={11} x={-8} y={276} />

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Progetto Esempio</h3>
            <span className="relative inline-flex items-center">
              <MessageCircle size={16} className="text-blue-500" />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
            </span>
            <span className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">
              <Bell size={10} /> UPD
            </span>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
            attivo
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-1">Cliente: Azienda Srl</p>

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Aggiornato: 22/04/2026
          </span>
          <span className="inline-flex items-center gap-1">
            Completamento previsto: <b className="text-gray-600">30/06/2026</b>
          </span>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Avanzamento</span>
            <span>65%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: '65%' }} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
          <span>8 attività</span>
        </div>

        <div className="flex items-center gap-1 mt-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">MR</span>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">GB</span>
        </div>

        <div className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700">
          ⚠️ Bloccato lato cliente
        </div>
      </div>
    </PageGuide>
  )
}
