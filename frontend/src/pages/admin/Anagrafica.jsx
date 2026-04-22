import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, Search, Mail, Phone, Building2, Download } from 'lucide-react'
import { anagrafica } from '../../api/client'
import HelpTip from '../../components/HelpTip'

const statusConfig = {
  utente_portale: { label: 'Utente portale', color: 'bg-purple-100 text-purple-800' },
  ref_interno: { label: 'Ref. interno', color: 'bg-teal-100 text-teal-800' },
  ref_esterno: { label: 'Ref. esterno', color: 'bg-amber-100 text-amber-800' },
}

export default function Anagrafica() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    anagrafica.list()
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (!q) return true
      const hay = [r.nome, r.cognome, r.email, r.azienda, r.ruolo, r.progetto_nome, r.attivita_nome]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [rows, filter, statusFilter])

  const counts = useMemo(() => ({
    tutti: rows.length,
    utente_portale: rows.filter(r => r.status === 'utente_portale').length,
    ref_interno: rows.filter(r => r.status === 'ref_interno').length,
    ref_esterno: rows.filter(r => r.status === 'ref_esterno').length,
  }), [rows])

  function exportCsv() {
    const header = ['Nome', 'Cognome', 'Email', 'Telefono', 'Azienda', 'Ruolo', 'Progetto', 'Attività', 'Status']
    const escape = v => {
      const s = v == null ? '' : String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [header.join(';'), ...filtered.map(r => [
      r.nome, r.cognome, r.email, r.telefono, r.azienda, r.ruolo, r.progetto_nome, r.attivita_nome,
      statusConfig[r.status]?.label || r.status,
    ].map(escape).join(';'))]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anagrafica-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 shrink-0">
          <Users size={22} className="text-blue-600" />
          Anagrafica
          <HelpTip text="Elenco unificato di utenti portale, referenti interni (dell'azienda cliente) e referenti esterni (terze parti legate a progetti o attività)." />
        </h1>
        <p className="text-[11px] text-gray-400 italic leading-snug max-w-[700px]">
          Vista aggregata di tutti i contatti presenti nel sistema. Filtra per tipologia o cerca per nome/email/azienda.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-[400px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Cerca nome, email, azienda..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: '', label: 'Tutti', count: counts.tutti, active: 'bg-blue-100 text-blue-800' },
            { key: 'utente_portale', label: 'Utenti portale', count: counts.utente_portale, active: statusConfig.utente_portale.color },
            { key: 'ref_interno', label: 'Ref. interni', count: counts.ref_interno, active: statusConfig.ref_interno.color },
            { key: 'ref_esterno', label: 'Ref. esterni', count: counts.ref_esterno, active: statusConfig.ref_esterno.color },
          ].map(f => (
            <button key={f.key || 'all'}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === f.key ? f.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {f.label} <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-white/60">{f.count}</span>
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          <Download size={14} /> Esporta CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Persona</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefono</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Azienda</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ruolo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contesto</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Nessun risultato</td></tr>
              ) : filtered.map((r, idx) => {
                const cfg = statusConfig[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={`${r.status}-${r.id}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{r.nome} {r.cognome}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                          <Mail size={12} /> {r.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {r.telefono && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} className="text-gray-400" /> {r.telefono}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {r.azienda && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={12} className="text-gray-400" /> {r.azienda}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.ruolo || ''}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {r.status === 'ref_esterno' && r.progetto_nome && (
                        <>
                          <Link to={`/admin/projects/${r.progetto_id || (r.attivita_id ? '' : '')}`} className="text-blue-600 hover:underline">
                            {r.progetto_nome}
                          </Link>
                          {r.attivita_nome && <span className="text-gray-400"> · {r.attivita_nome}</span>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Totale: {filtered.length} {statusFilter ? `(filtrati da ${rows.length})` : ''}
      </p>
    </div>
  )
}
