import { useState, useEffect, useMemo } from 'react'
import { Users, Search, Mail, Phone, Building2, Download, Trash2 } from 'lucide-react'
import { anagrafica, clients as clientsApi } from '../../api/client'
import HelpTip from '../../components/HelpTip'

const statusConfig = {
  utente_portale: { label: 'Utente portale', color: 'bg-purple-100 text-purple-800' },
  ref_interno: { label: 'Ref. interno', color: 'bg-teal-100 text-teal-800' },
  ref_esterno: { label: 'Ref. esterno', color: 'bg-amber-100 text-amber-800' },
}

function personKey(r) {
  if (r.status === 'utente_portale') return `up-${r.id}`
  if (r.status === 'ref_interno') return `ri-${r.id}`
  return `re-${(r.email || '').toLowerCase()}`
}

export default function Anagrafica() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deletingKey, setDeletingKey] = useState(null)

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
  const isAdmin = currentUser.ruolo === 'admin'

  function loadRows() {
    setLoading(true)
    anagrafica.list()
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRows() }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false
      if (!q) return true
      const contestiStr = (r.contesti || []).map(c => `${c.progetto || ''} ${c.attivita || ''}`).join(' ')
      const hay = [r.nome, r.cognome, r.email, r.azienda, r.ruolo, contestiStr]
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
    const header = ['Nome', 'Cognome', 'Email', 'Telefono', 'Azienda', 'Ruolo', 'Contesti', 'Status']
    const escape = v => {
      const s = v == null ? '' : String(v)
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [header.join(';'), ...filtered.map(r => {
      const contesti = (r.contesti || []).map(c => c.progetto + (c.attivita ? ` · ${c.attivita}` : '')).join(' | ')
      return [
        r.nome, r.cognome, r.email, r.telefono, r.azienda, r.ruolo, contesti,
        statusConfig[r.status]?.label || r.status,
      ].map(escape).join(';')
    })]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anagrafica-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(r) {
    const nome = `${r.nome} ${r.cognome || ''}`.trim()
    const n = (r.contesti || []).length
    let msg
    if (r.status === 'utente_portale') {
      msg = `Eliminare l'utente portale "${nome}"? L'azione è irreversibile.`
    } else {
      const ctx = n === 1 ? '1 contesto' : `${n} contesti`
      msg = `Eliminare "${nome}" da TUTTI i contesti (${ctx})? L'azione è irreversibile.`
    }
    if (!confirm(msg)) return
    const key = personKey(r)
    setDeletingKey(key)
    try {
      if (r.status === 'utente_portale') {
        if (!r.cliente_id) throw new Error('cliente_id mancante')
        await clientsApi.deleteUser(r.cliente_id, r.id)
      } else if (r.status === 'ref_interno') {
        await anagrafica.deleteRefInterno(r.id)
      } else if (r.status === 'ref_esterno') {
        await anagrafica.deleteRefEsternoByEmail(r.email)
      }
      loadRows()
    } catch (err) {
      alert(err.message || 'Errore durante eliminazione')
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 shrink-0">
          <Users size={22} className="text-blue-600" />
          Anagrafica
          <HelpTip text="Elenco unificato di utenti portale, referenti interni (dell'azienda cliente) e referenti esterni (terze parti legate a progetti o attività). Il cestino elimina la persona da TUTTI i contesti." />
        </h1>
        <p className="text-[11px] text-gray-400 italic leading-snug max-w-[700px]">
          Vista aggregata di tutti i contatti presenti nel sistema. Filtra per tipologia o cerca per nome/email/azienda/contesto.
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
            placeholder="Cerca nome, email, azienda, progetto..."
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
                {isAdmin && <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-6 text-center text-gray-400">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-6 text-center text-gray-400">Nessun risultato</td></tr>
              ) : filtered.map((r) => {
                const cfg = statusConfig[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
                const key = personKey(r)
                const contesti = r.contesti || []
                return (
                  <tr key={key} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{r.nome} {r.cognome}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 break-all">
                          <Mail size={12} className="shrink-0" /> {r.email}
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
                    <td className="px-4 py-2.5">
                      {contesti.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Non assegnato</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[340px]">
                          {contesti.map((c, i) => (
                            <span key={i} className="inline-flex items-center bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap">
                              {c.progetto}{c.attivita ? ` · ${c.attivita}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={deletingKey === key}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors"
                          title="Elimina da tutti i contesti"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
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
