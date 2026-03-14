# Claude Code — Istruzioni Operative

> Questo file contiene regole e contesto per Claude Code. Per la documentazione completa del progetto, vedi `README.md`.

## Ambiente di Sviluppo

- **OS**: Windows 11, shell bash
- **Node.js PATH** (spesso necessario): `export PATH="/c/Program Files/nodejs:$PATH"`
- **File encoding**: CRLF — attenzione con Grep/replace_all, potrebbe fallire silenziosamente
- **DB locale**: SQLite in `backend/data/ticketing.db` (NON committare)
- **DB produzione**: MySQL 5.6+ su Aruba shared hosting

## Credenziali Demo (solo sviluppo locale)

| Ruolo | Email | Password |
|-------|-------|----------|
| Admin | admin@ticketing.local | admin123 |
| Tecnico | tecnico@ticketing.local | tecnico123 |
| Client (Rossi Srl) | giuseppe.rossi@rossisrl.it | cliente123 |
| Client (Tech Solutions) | marco.tech@techsolutions.it | cliente123 |

## Convenzioni Codice

- **Frontend**: componenti funzionali React, hooks, Tailwind CSS v4 utility classes (NO shadcn/ui)
- **Icone**: lucide-react (import singoli, es. `import { Ticket } from 'lucide-react'`)
- **API client**: `frontend/src/api/client.js` contiene TUTTE le chiamate API (admin + client) in un unico file
- **i18n**: `frontend/src/i18n/clientTranslations.js` — funzioni `t(key)`, `getDateLocale()`, `getClientLang()`
- **Backend Node.js**: Express router pattern, better-sqlite3 sync queries
- **Backend PHP**: PDO MySQL, router custom in `php/api/index.php`
- **Versione**: `frontend/src/version.js` — formato `V{X}.{Y}.{ZZ}-MMGG` (vedi sezione Versioning)

## Gotcha e Trappole

- **PHP restituisce numeri come stringhe**: usare `!!value` per check truthy, MAI `=== 1`
- **sessionStorage** (non localStorage): `token` per admin, `clientToken` per client
- **Solo HTTP 401 triggera logout** automatico, non 403
- **Migrazioni Node.js**: in `backend/src/db/database.js` (`runMigrations()`), girano all'avvio
- **Migrazioni PHP**: in `php/api/migrations/`, protette da flag file `_ENABLE_MIGRATE` + chiave dedicata `MIGRATE_KEY`
- **IMAP tags**: `[TICKET #TK-YYYY-NNNN]` per ticket, `[COMM slug]` per comunicazioni client
- **Dedup email**: via colonna `message_id` UNIQUE

## Deploy Produzione

```bash
# Build frontend (emptyOutDir false perche Dropbox blocca dist)
cd frontend && npx vite build --emptyOutDir false

# Deploy frontend su Aruba via FTP
node deploy/deploy.js --frontend

# Deploy PHP backend su Aruba via FTP
node deploy/deploy.js --php
```

## Regole Git e Versioning

- Branch principale: `main`
- Repository: `https://github.com/rickycots/ticketing.git`
- Dopo ogni modifica ai file, chiedere sempre all'utente se vuole fare un commit prima di procedere

### Schema versione: `V{X}.{Y}.{ZZ}-MMGG`

| Segmento | Range | Significato | Quando incrementare |
|----------|-------|-------------|---------------------|
| **X** | 1-10 | Major | Cambiamento architetturale o milestone importante |
| **Y** | 0-10 | Minor | Nuova funzionalita significativa |
| **ZZ** | 00-99 | Patch | Fix, miglioramenti, modifiche piccole |
| **MMGG** | | Data | Sempre aggiornata alla data corrente |

**Regole incremento:**
- **Release maggiore** (utente risponde "maggiore"): incrementare X o Y, azzerare ZZ → es. `3.0.00` → `3.1.00`
- **Release minore** (utente risponde "minore"): incrementare solo ZZ → es. `3.0.00` → `3.0.01`
- Versione corrente: `V3.0.00-0314`

---

### CHECKLIST COMMIT — OBBLIGATORIA, NESSUNA ECCEZIONE

**Prima di chiedere conferma al commit, CHIEDI SEMPRE:**
> "Versione maggiore o minore?"

**Poi esegui TUTTI questi passi nell'ordine. NON saltarne nessuno.**

- [ ] **1. VERSIONE** — Incrementare `frontend/src/version.js` secondo la risposta dell'utente
- [ ] **2. VERSIONI.md** — Aggiungere sezione in cima con versione, data e lista modifiche
- [ ] **3. README.md** — Aggiornare la documentazione (nuovi file, struttura, endpoint, sezioni, schema DB, ecc.)
- [ ] **4. COMMIT** — Includere version.js + VERSIONI.md + README.md + tutti i file modificati
- [ ] **5. TAG** — `git tag -a vX.Y.ZZ-MMGG -m "VX.Y.ZZ-MMGG Descrizione"`
- [ ] **6. PUSH** — `git push && git push --tags`
- [ ] **7. BUILD + DEPLOY FRONTEND** — `cd frontend && npx vite build --emptyOutDir false && cd .. && node deploy/deploy.js --frontend`
- [ ] **8. DEPLOY PHP** — `node deploy/deploy.js --php` (se sono stati modificati file PHP/backend)

> **NON DIMENTICARE MAI i passi 2, 3, 6, 7.** Ogni commit DEVE includere VERSIONI.md e README.md aggiornati, DEVE essere pushato, e DEVE essere deployato.

**Messaggio al termine:**
> "VX.Y.ZZ-MMGG committato, taggato, pushato e deployato (frontend + PHP). + agg. README e VERSIONI"

Se README o VERSIONI non sono stati aggiornati, DILLO esplicitamente — non nasconderlo.

### Esempio completo

```bash
# 1. Aggiornare version.js → V3.1.00-0314
# 2. Aggiornare VERSIONI.md
# 3. Aggiornare README.md
# 4. Commit
git add <files modificati> frontend/src/version.js VERSIONI.md README.md
git commit -m "V3.1.00-0314 Add feature X and fix Y"
# 5. Tag
git tag -a v3.1.00-0314 -m "V3.1.00-0314 Add feature X and fix Y"
# 6. Push
git push && git push --tags
# 7. Build + deploy frontend
cd frontend && npx vite build --emptyOutDir false
cd .. && node deploy/deploy.js --frontend
# 8. Deploy PHP (se modificato)
node deploy/deploy.js --php
```
