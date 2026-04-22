import { useState, useEffect, useMemo } from 'react'
import { Users, Search, Mail, Phone, Building2, Download, Trash2, Pencil, X as XIcon } from 'lucide-react'
import { anagrafica, clients as clientsApi } from '../../api/client'
import HelpTip from '../../components/HelpTip'
import Pagination from '../../components/Pagination'

const PAGE_SIZE = 15

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
  const [page, setPage] = useState(1)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({ nome: '', cognome: '', email: '', telefono: '', ruolo: '', azienda: '' })
  const [savingEdit, setSavingEdit] = useState(false)

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

  // Reset page when filter/search changes
  useEffect(() => { setPage(1) }, [filter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

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

  function openEdit(r) {
    setEditRow(r)
    setEditForm({
      nome: r.nome || '',
      cognome: r.cognome || '',
      email: r.email || '',
      telefono: r.telefono || '',
      ruolo: r.ruolo || '',
      azienda: r.azienda || '',
    })
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editRow) return
    setSavingEdit(true)
    try {
      const r = editRow
      if (r.status === 'utente_portale') {
        if (!r.cliente_id) throw new Error('cliente_id mancante')
        await clientsApi.updateUser(r.cliente_id, r.id, {
          nome: editForm.nome,
          cognome: editForm.cognome,
          email: editForm.email,
        })
      } else if (r.status === 'ref_interno') {
        await anagrafica.updateRefInterno(r.id, {
          nome: editForm.nome, cognome: editForm.cognome, email: editForm.email,
          telefono: editForm.telefono, ruolo: editForm.ruolo,
        })
      } else if (r.status === 'ref_esterno') {
        await anagrafica.updateRefEsternoByEmail(r.email, {
          nome: editForm.nome, cognome: editForm.cognome, email: editForm.email,
          telefono: editForm.telefono, ruolo: editForm.ruolo, azienda: editForm.azienda,
        })
      }
      setEditRow(null)
      loadRows()
    } catch (err) {
      alert(err.message || 'Errore durante salvataggio')
    } finally {
      setSavingEdit(false)
    }
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
                <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">TEL</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Azienda</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ruolo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contesto</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                {isAdmin && <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-6 text-center text-gray-400">Caricamento...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 7} className="px-4 py-6 text-center text-gray-400">Nessun risultato</td></tr>
              ) : paginated.map((r) => {
                const cfg = statusConfig[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
                const key = personKey(r)
                const contesti = r.contesti || []
                return (
                  <tr key={key} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{r.nome} {r.cognome}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                          <Mail size={12} className="shrink-0" /> {r.email}
                        </a>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {r.telefono ? (
                        <a href={`tel:${r.telefono}`} title={r.telefono} className="inline-flex items-center justify-center p-1 rounded text-green-600 hover:bg-green-50 cursor-pointer">
                          <Phone size={14} />
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
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
                    <td className="px-4 py-2.5 max-w-[240px]">
                      {contesti.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Non assegnato</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {contesti.map((c, i) => (
                            <span key={i} className="inline-flex items-baseline gap-1 bg-blue-50 text-[11px] px-2 py-0.5 rounded-full break-words">
                              <span className="text-blue-700 font-medium">{c.progetto}</span>
                              {c.attivita && <span className="italic text-gray-500">· {c.attivita}</span>}
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
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                          title="Modifica dati"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={deletingKey === key}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors ml-1"
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
        {filtered.length > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Totale: {filtered.length} {statusFilter ? `(filtrati da ${rows.length})` : ''}
      </p>

      {/* Edit modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !savingEdit && setEditRow(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-sm">
                Modifica {editRow.status === 'utente_portale' ? 'utente portale' : editRow.status === 'ref_interno' ? 'referente interno' : 'referente esterno'}
              </h3>
              <button onClick={() => setEditRow(null)} disabled={savingEdit} className="p-1 rounded hover:bg-gray-100 cursor-pointer disabled:opacity-50">
                <XIcon size={16} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input type="text" required value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cognome</label>
                  <input type="text" value={editForm.cognome} onChange={e => setEditForm(f => ({ ...f, cognome: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" required value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              {(editRow.status === 'ref_interno' || editRow.status === 'ref_esterno') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Telefono</label>
                      <input type="text" value={editForm.telefono} onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ruolo</label>
                      <input type="text" value={editForm.ruolo} onChange={e => setEditForm(f => ({ ...f, ruolo: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  {editRow.status === 'ref_esterno' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Azienda</label>
                      <input type="text" value={editForm.azienda} onChange={e => setEditForm(f => ({ ...f, azienda: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                    </div>
                  )}
                </>
              )}
              {editRow.status === 'ref_esterno' && (editRow.contesti?.length || 0) > 1 && (
                <p className="text-xs text-amber-600 italic bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Nota: questo referente esterno è presente in {editRow.contesti.length} contesti. La modifica si applicherà a tutti.
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingEdit} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {savingEdit ? 'Salvataggio...' : 'Salva'}
                </button>
                <button type="button" onClick={() => setEditRow(null)} disabled={savingEdit} className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 disabled:opacity-50 cursor-pointer">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
