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
- **Versione**: `frontend/src/version.js` — formato `V{major}.{minor}-MMGG`

## Gotcha e Trappole

- **PHP restituisce numeri come stringhe**: usare `!!value` per check truthy, MAI `=== 1`
- **sessionStorage** (non localStorage): `token` per admin, `clientToken` per client
- **Solo HTTP 401 triggera logout** automatico, non 403
- **Migrazioni Node.js**: in `backend/src/db/database.js` (`runMigrations()`), girano all'avvio
- **Migrazioni PHP**: in `php/api/migrations/`, eseguite via browser con chiave JWT
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

### Procedura commit (ogni volta che l'utente conferma il commit)

1. **Incrementare la versione** in `frontend/src/version.js` — formato `V{major}.{minor}-MMGG`
   - Incrementare il minor per ogni nuovo commit (es. V1.6 → V1.7)
   - Aggiornare MMGG alla data corrente
2. **Messaggio commit** con prefisso versione: `V1.7-0313 Descrizione breve delle modifiche`
3. **Creare tag git annotato**: `git tag -a v1.7-0313 -m "V1.7-0313 Descrizione"`
4. **Aggiornare `VERSIONI.md`**: aggiungere in cima una nuova sezione con versione, data e lista modifiche
5. Includere `version.js` e `VERSIONI.md` nello stesso commit

### Esempio completo

```bash
# 1. Aggiornare version.js → V1.7-0313
# 2. Aggiornare VERSIONI.md con la nuova sezione
# 3. Commit
git add <files modificati> frontend/src/version.js VERSIONI.md
git commit -m "V1.7-0313 Add feature X and fix Y"
# 4. Tag
git tag -a v1.7-0313 -m "V1.7-0313 Add feature X and fix Y"
```
