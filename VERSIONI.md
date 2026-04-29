# Storico Versioni

## V5.24.00-0429 — 29 Aprile 2026 (release maggiore)
### Fix data_evasione + label stato ticket più chiari
- **Bug data_evasione**: alla creazione del ticket il backend pre-popolava `data_evasione` con la *data target SLA* (created + 1g/3g), ma la colonna semanticamente è la data di risoluzione effettiva. Ora `data_evasione` resta NULL fino al passaggio di stato → 'risolto', momento in cui viene impostata a `CURDATE()` (comportamento già corretto del PUT). Fix sia in `backend/src/routes/tickets.js` (creazione manuale + da email) sia in `php/api/routes/tickets.php`
- **Dashboard scadenze tecnico**: la query usava `data_evasione` come deadline SLA → ora calcola dinamicamente la scadenza come `created_at + sla_reazione days` (1g/3g), filtrando solo clienti con SLA contrattualizzata. Aggiornato in `backend/src/routes/dashboard.js` e `php/api/routes/dashboard.php`
- **Migrazione cleanup**: `UPDATE ticket SET data_evasione = NULL WHERE stato NOT IN ('risolto','chiuso')` aggiunta sia in `database.js` sia in `migrate.php` per ripulire i dati esistenti
- **Label stato ticket** (`frontend/src/pages/admin/TicketList.jsx`): `Risolto` → `Risolto da STM`, `Chiuso` → `Chiuso dal Cliente` (più espliciti su chi ha eseguito l'azione, sia nei pallini di filtro/legenda sia nei badge di stato)

## V5.23.00-0429 — 29 Aprile 2026 (release maggiore)
### Cambio password volontario per admin/tecnici e client
- Nuovo componente riusabile `frontend/src/components/ChangePasswordModal.jsx`: 3 campi (password attuale, nuova, conferma), toggle visibilità, messaggio di successo, supporto label tradotte
- **Sidebar admin/tecnico** (`AdminLayout.jsx`): icona `KeyRound` accanto al nome utente in basso → apre il modale
- **Sidebar client** (`ClientLayout.jsx`): stessa icona accanto al nome utente, label tradotte (IT/EN/FR) tramite `clientTranslations.js`
- **Backend hardening**: gli endpoint `PUT /api/auth/change-password` (admin) e `POST /api/client-auth/change-password` (client) ora accettano un campo `oldPassword` opzionale; se presente lo verificano con bcrypt prima di consentire il cambio. Il flow forzato di primo login (che non passa `oldPassword`) resta invariato
- Frontend `auth.changePassword(password, oldPassword?)` e `clientAuth.changePassword(newPassword, oldPassword?)`: secondo argomento opzionale, mandato solo se valorizzato

## V5.22.00-0429 — 29 Aprile 2026 (release maggiore)
### Sicurezza utenti admin/tecnico: 2FA + admin editabile + BCC dinamico
- **Doppia autenticazione (2FA) per admin e tecnici**: nuovo flag per-utente `two_factor`. Al login, se attivo, viene inviato un codice 6 cifre via email noreply (scadenza 10 min, max 3 tentativi, lockout dopo). Mirrorata la logica già usata sul portale cliente
  - DB: nuove colonne `two_factor`, `two_factor_code`, `two_factor_expires`, `two_factor_attempts` su tabella `utenti` (Node SQLite + PHP MySQL)
  - Backend Node: nuovo endpoint `POST /api/auth/verify-2fa`, login restituisce `require_2fa: true` + `temp_token` se l'utente ha 2FA attiva
  - Backend PHP: stesso flow con token tipo `2fa_pending_admin` per evitare collisioni col flusso cliente
  - Frontend `Login.jsx`: nuova modale di verifica codice 6 cifre con UX identica al `ClientLogin`
  - `UserList.jsx`: checkbox "Doppia autenticazione" in form crea + entrambi i form modifica (estesa e compatta), badge `ShieldCheck` accanto al ruolo nelle card, colonna "2FA" in tabella compatta
- **Account admin modificabile**: rimosso il guard `u.ruolo !== 'admin'` dal bottone "Modifica" → admin ora può aggiornare nome/email/password del proprio account (e di altri admin) direttamente da `/admin/users`. Disattiva ed Elimina restano bloccati per gli admin per evitare lockout accidentali
- **BCC mail di assistenza dinamico**: rimosso `riccardo@stmdomotica.it` hardcoded da `backend/src/services/mailer.js` e `php/api/core/Mailer.php`. Nuova funzione `getAdminBcc()` che legge la mail dell'admin attivo dal DB (`SELECT email FROM utenti WHERE ruolo='admin' AND attivo=1 LIMIT 1`), con fallback su env/costante `MAIL_ADMIN_BCC`. Cambiando l'admin in Anagrafica/UserList si aggiornano automaticamente sia le notifiche dirette sia il BCC

## V5.21.03-0422 — 22 Aprile 2026
### Crea Ticket da email: descrizione come primo messaggio del thread (testo pulito)
- Modal "Crea Ticket": il corpo email viene convertito in testo pulito (via DOMParser, strip HTML preservando newline) e precompila il campo Descrizione (editabile)
- Backend (Node + PHP): la mail sorgente NON viene più riagganciata al ticket — resta intatta nell'inbox. La descrizione del ticket diventa concettualmente il primo messaggio del thread
- `creatore_email` salvato come mittente originale della mail → appare come "Owner" del primo messaggio nel ticket
- TicketDetail: nuovo box "Primo messaggio" in cima al thread che rende `ticket.descrizione` con mittente = creatore_email e data = created_at del ticket. Visibile sia per ticket nati da email sia per ticket aperti dal portale client
- Round-trip: le risposte del cliente alla mail di notifica arrivano su ticketing@ con tag [TICKET #TK-...] e vengono auto-agganciate al thread (comportamento invariato)

## V5.21.02-0422 — 22 Aprile 2026
- EmailInbox: bottone "Crea Ticket da questa email" spostato sotto la select Cliente e disabilitato finché un cliente non è selezionato (con tooltip e hint inline)
- Guida EmailInbox aggiornata di conseguenza

## V5.21.01-0422 — 22 Aprile 2026
- EmailInbox: rimosso bottone "Nuova Email" e relativo compose form inline (funzionalità già presente in sidebar "Invia Mail")
- Guida EmailInbox aggiornata di conseguenza (items rinumerati, aggiunta nota "usa la sidebar per nuova email")

## V5.21.00-0422 — 22 Aprile 2026 (release maggiore)
### Guide visuali in-app estese a 5 pagine principali
- Nuove guide con bottone "📖 Guida" in alto a destra nelle pagine:
  - `/admin/anagrafica` → `AnagraficaGuide` (10 elementi: ricerca, filtri tipologia, export CSV, email, TEL, contesto, status, matita, cestino, paginazione)
  - `/admin/emails` → `EmailInboxGuide` (10 elementi: filtri rapidi, filtri strutturati, nuova email, lista card, flag lettura, direzione, rilevanza, rispondi, crea ticket, assegnazioni)
  - `/admin/tickets` → `TicketListGuide` (8 elementi: filtri stato, ricerca, riga, codice, priorità, cliente, SLA, assegnato)
  - `/admin/projects/:id/activities/:aid` → `ActivityDetailGuide` (11 elementi: header, badge, barra avanzamento, date, toggle descrizione/allegati/tecnici/referenti/ref.esterni/dipendenze, stato attiva)
- Pattern: ogni guida è un componente `guides/XxxGuide.jsx` che usa `PageGuide` con mock visuale della pagina + pallini rossi numerati + legenda descrittiva
- `CLAUDE.md` aggiornato con elenco pagine con guida attiva (regola obbligatoria: aggiornare la guida a ogni modifica UI)

## V5.20.00-0422 — 22 Aprile 2026 (release maggiore)
### Guida visuale in-app (prototipo su ProjectList)
- Nuovo componente riutilizzabile `components/PageGuide.jsx`: drawer laterale con area "screenshot annotato" (pallini numerati rossi sovrapposti al mock del componente) + legenda descrittiva
- Helper `<GuideNumber>` per posizionare in absolute i pallini numerati rossi
- Prima implementazione: `components/guides/ProjectListGuide.jsx` — mock di `ProjectMiniBox` con 11 elementi annotati (nome, badge chat, badge UPD, stato, cliente, pallino aggiornamento, completamento previsto, barra avanzamento, numero attività, tecnici, banner blocco)
- `ProjectList.jsx` (admin `/admin/projects`): nuovo bottone "📖 Guida" accanto a "Nuovo Progetto" — apre il drawer della guida
- Pattern replicabile su altre pagine: basta creare `guides/XxxGuide.jsx` e agganciare il bottone

## V5.19.02-0422 — 22 Aprile 2026
- ProjectMiniBox: aggiunto HelpTip accanto a "Aggiornato:" con spiegazione del campo `updated_at` e dei colori del pallino (verde <3gg, giallo 3-7gg, grigio >7gg). Visibile sia admin sia tecnico in tutte le liste progetti.

## V5.19.01-0422 — 22 Aprile 2026
- Hotfix: `GET /api/projects` restituiva HTTP 500 — la query `hasProjectUpdates` referenziava `email.created_at` inesistente (tabella `email` ha solo `data_ricezione`). Corretto in PHP + Node.

## V5.19.00-0422 — 22 Aprile 2026 (release maggiore)
### Badge "UPD" per progetti con aggiornamenti nuovi
- Nuova tabella `progetto_letture(utente_id, progetto_id, last_seen_at)` con lazy migration PHP + Node
- Endpoint `GET /api/projects` arricchito con campo `has_updates: boolean` per ogni progetto: true se esistono email o note (interne di progetto + di attività) create dopo `last_seen_at` per l'utente loggato, su progetto o sue attività
- Endpoint `GET /api/projects/:id` ora fa upsert automatico di `last_seen_at = NOW()` → il badge si azzera all'apertura del ProjectDetail
- Primo accesso a un progetto mai aperto → tutto considerato nuovo (since = 1970-01-01)
- **Frontend** `ProjectMiniBox`: nuovo badge arancione "🔔 UPD" accanto al badge chat quando `has_updates === true`. Visibile in ProjectList, Timeline, ClientDashboard e ovunque usi ProjectMiniBox
- Sia email ricevute sia inviate contribuiscono al segnale; le chat hanno già il loro badge dedicato e non contribuiscono a UPD

## V5.18.00-0422 — 22 Aprile 2026 (release maggiore)
### Crea Ticket da email su assistenzatecnica@
- Nuovo endpoint `POST /api/tickets/from-email/:emailId` (Node + PHP, admin only):
  - Crea ticket con codice `TK-YYYY-NNNN`
  - Aggancia la mail sorgente al ticket (`tipo='ticket'`, `ticket_id`, `thread_id='thread-{codice}'`)
  - Invia auto-reply al mittente da `ticketing@` con testo: *"abbiamo aperto il ticket {codice}. Per proseguire puoi accedere al portale o rispondere a questa mail."*
  - Se specificato, notifica anche un utente del portale (mail informativa con link al ticket)
- **Perché funziona il round-trip**: l'auto-reply viene inviata da `ticketing@` col subject `[TICKET #TK-...]` → se il cliente risponde, la reply arriva su `ticketing@`, il cron IMAP la riconosce dal tag e la aggancia automaticamente al thread del ticket (chat admin del ticket)
- **Frontend** `EmailInbox.jsx`:
  - Bottone arancione "Crea Ticket da questa email" sopra la tendina Cliente (nascosto se la mail è già un ticket)
  - Modal di conferma con: Cliente, Oggetto, Categoria (assistenza/bug/richiesta_info/altro), Priorità (bassa/media/alta), Descrizione — tutti pre-compilati dai dati email
  - Check automatico: se il mittente dell'email non è tra gli utenti del portale del cliente selezionato, mostra popup ambra con select "utente portale da notificare"
  - Feedback inline: verde se il mittente è già utente portale, ambra altrimenti
- API client: `tickets.createFromEmail(emailId, data)`

## V5.17.02-0422 — 22 Aprile 2026
- Anagrafica: colonna "Telefono" compattata in "TEL" (3 caratteri) — icona verde cliccabile `tel:` con tooltip al mouseover che mostra il numero
- Anagrafica: nuova matita accanto al cestino per modificare i dati della persona via popup modale
- Modal con campi condizionali per tipo: utente portale (nome/cognome/email), ref interno (+ telefono/ruolo), ref esterno (+ azienda)
- Ref. esterno multi-contesto: avviso nel modal che la modifica si applica a tutti i contesti
- Nuovi endpoint bulk admin-only:
  - `PUT /anagrafica/ref-interno/:id` (Node + PHP)
  - `PUT /anagrafica/ref-esterno?email=...` (Node + PHP) — aggiorna tutti i record con stessa email

## V5.17.01-0422 — 22 Aprile 2026
- Anagrafica: chip Contesto con stile differenziato (progetto in blu medium, attività in corsivo grigio dopo `·`)
- Anagrafica: colonna Email sempre su una riga per esteso (rimosso `break-all`)
- Anagrafica: colonna Contesto con `max-w-[240px]` — i chip vanno a capo, la colonna non straborda
- Anagrafica: paginazione a 15 righe per pagina; il paginator appare solo se i risultati filtrati sono >15; reset automatico a pagina 1 al cambio di filtro/ricerca

## V5.17.00-0422 — 22 Aprile 2026 (release maggiore)
### Anagrafica: aggregazione contesti + eliminazione persona
- **Endpoint `/anagrafica` ristrutturato**: ora restituisce per ogni persona un array `contesti` con l'elenco dei progetti/attività a cui è associata (Node + PHP)
  - Ref interni: `contesti` popolato via JOIN con `progetto_referenti` + `attivita_referenti`
  - Ref esterni: aggregati per email (case-insensitive), una sola riga anche con N assegnazioni — la cella mostra tutti i contesti come chip
  - Utenti portale: `contesti` vuoto (la loro affiliazione è nell'azienda cliente)
- **Frontend Anagrafica**:
  - Colonna "Contesto" renderizzata come chip blu (multi-progetto/attività); se vuota mostra "Non assegnato"
  - Nuova colonna azione con icona **cestino** (solo admin): elimina la persona da TUTTI i contesti con conferma che riporta il numero di assegnazioni
  - Ricerca estesa: ora cerca anche dentro i nomi di progetti/attività
- **Nuovi endpoint DELETE** (admin only):
  - `DELETE /anagrafica/ref-interno/:id` — cascata su `progetto_referenti` + `attivita_referenti` + `referenti_progetto` in transazione
  - `DELETE /anagrafica/ref-esterno?email=...` — bulk delete di tutti i record con quell'email
  - Gli utenti portale sono eliminati tramite l'endpoint esistente `DELETE /clients/:cid/users/:uid`

## V5.16.00-0422 — 22 Aprile 2026 (release maggiore)
### SendMail: fix caricamento Ref. Esterni + raggruppamento destinatari
- **Fix race condition**: i referenti esterni non comparivano nel box destinatari quando si arrivava da un'attività, perché il reload del progetto sovrascriveva i contacts dopo il caricamento ref esterni
- Refactor con state separati (`refInterniList`, `refEsterniList`, `utentiPortaleList`) unificati via `useMemo` con dedup per email — elimina la race condition indipendentemente dall'ordine di arrivo delle risposte async
- **UI raggruppata**: i destinatari sono ora mostrati in sezioni logiche separate da righe sottili: Referenti → Ref. Esterni → Utenti portale
- Ordine di visualizzazione fisso e prevedibile; se una sezione è vuota, non viene mostrato separatore orfano

## V5.15.00-0422 — 22 Aprile 2026 (release maggiore)
### Fix PWA cache refresh e routing SPA
- **Service Worker** (`sw.js`): bump cache name `stm-portal-v1` → `v2`, forza tutti i client PWA a scaricare la nuova versione al prossimo caricamento
- Handler `activate` esteso: cancella tutte le cache vecchie prima di `clients.claim()` (prima si accumulavano indefinitamente)
- Handler `fetch` più restrittivo: ora skippa anche risorse **cross-origin** (es. Google Fonts) evitando che il SW intercetti/cachi richieste esterne
- **`.htaccess`** produzione:
  - CSP `connect-src` esteso a `fonts.googleapis.com` e `fonts.gstatic.com` per compatibilità con il nuovo SW
  - Routing SPA: esclude `index.html` e `/` dal pass-through diretto — ora vanno sempre attraverso `index.php` (che serve `_app.html` con header no-cache), garantendo che il frontend non venga servito stale da cache Aruba
- **Effetto**: al prossimo caricamento PWA il client riscarica il bundle aggiornato automaticamente. Non sarà più necessario Ctrl+Shift+R manuale dopo ogni deploy.

## V5.14.00-0422 — 22 Aprile 2026 (release maggiore)
### Referenti Esterni e Anagrafica Unificata
- Nuova entità **Referenti Esterni**: contatti terzi (non appartenenti all'azienda cliente) collegabili a un singolo progetto o a una singola attività
- Nuova tabella `referenti_esterni` (campi: progetto_id/attivita_id esclusivi, nome, cognome, email, telefono, ruolo, azienda)
- DB migration lazy (PHP: `ensureReferentiEsterniTable`, Node.js: migration in `database.js`) + schema in `001_schema.sql`
- Endpoint CRUD: `GET/POST /projects/:id/referenti-esterni`, `POST /projects/:id/activities/:aid/referenti-esterni`, `PUT/DELETE /referenti-esterni/:id` (sia PHP sia Node.js)
- Permessi: admin + tecnici assegnati al progetto
- `ActivityDataBox` e `ProjectDataBox`: nuovo toggle "Ref. Esterni" (ambra) a fianco di "Referenti" con lista + form inline add/delete
- `ActivityDetail`: carica solo i ref esterni legati all'attività specifica (no ereditarietà dal progetto)
- `ProjectDetail`: mostra tutti i ref esterni del progetto (sia progetto-level sia activity-level, con indicazione "(attività: X)")
- `SendMail`: i ref esterni vengono proposti nei destinatari con badge ambra. Scope coerente: da attività solo quelli dell'attività, da progetto solo quelli a livello progetto
- Testo corsivo sotto campo destinatari aggiornato con menzione "Ref. Esterni"

### Nuova pagina Anagrafica
- Pagina `/admin/anagrafica`: elenco unificato di utenti portale, referenti interni e referenti esterni
- Endpoint `GET /anagrafica` (admin + tecnici) con join su clienti/progetti/attività
- Filtri rapidi per tipologia (Utenti portale / Ref. interni / Ref. esterni) + ricerca full-text (nome, email, azienda, ruolo, progetto, attività)
- Export CSV della vista filtrata con separatore `;` e BOM UTF-8 per Excel

### Ristrutturazione Sidebar admin
- Rimosse label testuali per voci Utenti, Comunicazioni, AI Assistente: ora sono in una **riga di icone compatte** sopra Repository (con tooltip su hover)
- Aggiunta nuova icona "Anagrafica" (Contact) nella stessa riga
- Repository resta l'unica voce testuale della sezione bottom

### Stato attività
- `ActivityDetail`: pulsante di completamento ora etichettato "Stato Attiva: Clicca per Completare" (prima "Segna come completata")

## V5.13.06-0422 — 22 Aprile 2026
- SendMail (`/admin/send-mail`): aggiunto pulsante "Annulla" accanto a "Invia Email"
- Ritorno contestuale: se si arriva da un'attività torna all'attività, se da un progetto torna al progetto, altrimenti `navigate(-1)`

## V5.13.05-0422 — 22 Aprile 2026
- IMAP polling (PHP + Node): ora preferisce HTML (renderizzato da `EmailBody` con DOMPurify) invece di plaintext
- Motivo: i client mail moderni spesso inviano versioni plaintext minimali o "castrate" come alternative multipart, causando email che apparivano troncate nel portale
- Rimosso `stripHtml()` dal cron IMAP: HTML conservato integro nel DB (sanitizzazione demandata al rendering lato client)
- Effetto solo sulle email ricevute dopo questa versione — le email già salvate nel DB restano come sono

## V5.13.04-0422 — 22 Aprile 2026
- EmailInbox admin (`/admin/emails`): ora usa il componente condiviso `EmailBody` per il rendering del corpo email (detail desktop, thread cards, popup mobile)
- Risolto troncamento HTML nella preview email: applica `preprocessHtml` (rimozione wrapper `<html><body><head>`), DOMPurify, splitting automatico chain risposte/inoltri e CSS `email-body-html` + `email-body-scroll` (overflow-wrap, tabelle/immagini responsive)
- Rimossa la funzione `sanitizeHtml()` locale obsoleta (sostituita da DOMPurify nel componente condiviso)

## V5.13.03-0420 — 20 Aprile 2026
- ClientProjectDetail box email: filtri Ordine (Ultime/Prime prima) + Direzione (Tutte / Da Assistenza / Dalla tua Azienda) con contatori
- Badge colorato per email: DA ASSISTENZA (viola) / DALLA TUA AZIENDA (teal)
- Backend Node.js `GET /api/projects/client/:clienteId/:projectId`: ora restituisce l'array `emails` (parità con PHP)

## V5.13.02-0420 — 20 Aprile 2026
- EmailBody plaintext: rilevamento automatico catena di risposte/inoltri e splitting in segmenti visivamente separati
- Marker rilevati: "Il ... ha scritto:" / "On ... wrote:", "-----Messaggio originale/Original Message/Inoltrato/Forwarded Message-----", blocchi header (3+ righe Da:/From:/A:/To:/Oggetto:/Subject:/Inviato:/Sent:/Data:/Date:/Cc:)
- Ogni segmento successivo: separatore con etichetta "Messaggio precedente", label marker in italic grigio, testo con bordo sinistro per nidificazione

## V5.13.01-0420 — 20 Aprile 2026
- EmailBody: fix overflow corpo email che usciva dal container
- CSS `.email-body-html`: `overflow-wrap: anywhere` + `word-break: break-word` + `max-width: 100%` su tutti i figli
- Link: `word-break: break-all` per URL lunghi; tabelle con `table-layout: auto` + max-width; celle/pre/code con break-word
- Nuovo wrapper `.email-body-scroll` con `overflow-x: auto` come safety-net per contenuti troppo larghi
- Rendering plaintext: aggiunto `break-words`

## V5.13.00-0420 — 20 Aprile 2026
- Nuovo componente condiviso `components/EmailBody.jsx`: rendering uniforme del corpo email con DOMPurify + detection HTML estesa (qualsiasi tag + entità codificate)
- `preprocessHtml`: rimozione wrapper `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<meta>`, `<link>` per evitare rendering grezzo di email con markup di pagina intera
- DOMPurify: bloccati anche `object`, `embed` e handler `onmouseover/onfocus/onblur` oltre a script/style/iframe
- `EmailBox` (admin ProjectDetail, ActivityDetail) refactorato per usare `EmailBody`
- Lato client: `ClientProjectDetail` (corpo email + email bloccante), `ProjectsView` (email bloccante), `TicketDetail` (entrambe le viste thread) ora usano `EmailBody`
- `ProjectGantt` (admin): corpo email con `EmailBody` per coerenza

## V5.12.00-0418 — 18 Aprile 2026
- Nuovo componente riutilizzabile `components/NotesBox.jsx` (props: notes, showBloccante, showSblocca, canSaveKB, onAdd)
- ProjectDetail: aggiunto box "Note Progetto" con inserimento nota, bloccante/sblocca e salva in KB
- Note progetto bloccanti: `is_bloccante=1` + `progetto.blocco='lato_admin'`; sblocca → azzera bloccanti + `blocco='nessuno'`
- DB: nuova colonna `note_interne.is_bloccante` (Node.js migration + PHP lazy)
- Gestione Progetto: "Fermo lato admin" ora disabled/grigio con suffisso "(automatico)" — impostabile solo tramite note bloccanti
- Endpoint `POST /api/projects/:id/notes` (Node.js + PHP) con supporto salva_in_kb / is_bloccante / sblocca

## V5.11.02-0418 — 18 Aprile 2026
- ProjectDetail sidebar "Gestione" → "Gestione Progetto"
- Stato progetto: rimosso "Annullato"; "Completato" disabled+grigio se ci sono attività non completate
- Blocco: "Fermo lato cliente" disabled+grigio (stato automatico impostato dal sistema)

## V5.11.01-0418 — 18 Aprile 2026
- ProjectDetail: HelpTip accanto al bollino rosso attività programmate con testo esplicativo

## V5.11.00-0418 — 18 Aprile 2026
- ProjectDetail: nelle card delle attività, bollino rosso in basso a destra con il numero di attività programmate future (data_pianificata >= oggi); cliccabile verso il dettaglio attività

## V5.10.15-0418 — 18 Aprile 2026
- Nuovo componente condiviso `components/EmailBox.jsx`: estratto box email da ProjectDetail (Email Progetto + Email Attività) e ActivityDetail per ridurre duplicazione
- Corpo email ora renderizzato come HTML sanitizzato (DOMPurify) se contiene tag HTML, altrimenti come testo; aggiunte regole CSS `.email-body-html` per formattazione (liste, mark/evidenziazione, link, blockquote, table)
- ActivityDetail: rinominato `emailTab` → `emailFilter`, allineata chiave `contesto` → `di_contesto`

## V5.10.14-0418 — 18 Aprile 2026
- ProjectDetail: se progetto bloccato da email (email_bloccante_id), apre automaticamente tab "Email Progetto" + filtro "Bloccanti" + direzione corretta

## V5.10.13-0418 — 18 Aprile 2026
- ProjectMiniBox: "Attività Bloccata" spostato nella riga in basso (stessa posizione dei label blocco cliente/admin), stile rosso full-width

## V5.10.12-0418 — 18 Aprile 2026
- ProjectMiniBox: badge "Attività Bloccata" (rosso) quando stato_calcolato === 'bloccato' (lista progetti /admin/projects)

## V5.10.11-0418 — 18 Aprile 2026
- ProjectDataBox: badge stato "Bloccato" rinominato "Attività Bloccata" quando deriva da un'attività bloccata (gli stati bloccato_cliente/bloccato_admin restano invariati)

## V5.10.10-0418 — 18 Aprile 2026
- Fix DELETE utente portale: rimozione preventiva righe in comunicazioni_lette (FK constraint) prima della DELETE su utenti_cliente
- Applicato su entrambi i backend (Node.js + PHP)

## V5.10.09-0418 — 18 Aprile 2026
- Fix eliminazione utenti portale in ClientDetail: optimistic update (rimozione immediata dallo state senza refetch)
- Alert di errore visibile all'utente invece del silenzioso console.error

## V5.10.08-0417 — 17 Aprile 2026
- Note Attività: toggle "Vecchi → Nuovi" / "Nuovi → Vecchi" per ordinamento cronologico

## V5.10.07-0417 — 17 Aprile 2026
- Note attività: badge rosso "NOTA BLOCCANTE" accanto al nome mittente + bordo sinistro rosso e sfondo rosso chiaro
- Badge scompare quando l'attività viene sbloccata (is_bloccante = 0)

## V5.10.06-0417 — 17 Aprile 2026
- Fix slider avanzamento in ActivityDetail: rimosso disabled per tecnico (era bloccato a !isAdmin)

## V5.10.05-0417 — 17 Aprile 2026
- Checkbox "Sblocca nota" nel form note attività (verde, visibile solo se attività bloccata)
- Mutuamente esclusiva con "Nota bloccante"
- Sblocco: rimuove is_bloccante da tutte le note bloccanti e riporta stato a in_corso (Node.js + PHP)

## V5.10.04-0417 — 17 Aprile 2026
- Stato attività auto-calcolato: "bloccata" da email o nota bloccante, solo "Completata" selezionabile manualmente
- Nuova colonna is_bloccante su note_attivita (Node.js + PHP, lazy migration)
- Checkbox "Questa nota è bloccante" nel form note attività
- Tendina stato sostituita con bottoni "Completa"/"Riapri" in ProjectDetail e ActivityDetail
- Stato "Bloccata" mostra indicazione "da email" o "da nota"

## V5.10.03-0417 — 17 Aprile 2026
- ActivityDetail: se attività bloccata da email, apre automaticamente il filtro "Bloccanti" con la direzione corretta (In arrivo/Inviate)

## V5.10.02-0417 — 17 Aprile 2026
- ProjectDataBox: mostra stato blocco progetto (lato_cliente arancione, lato_admin rosso) nel badge stato

## V5.10.01-0411 — 15 Aprile 2026
- ProjectDataBox: toggle Tecnici sempre visibile per admin (anche con 0 tecnici, per assegnarli)

## V5.10.00-0411 — 15 Aprile 2026
- Nuova tabella attivita_referenti (junction many-to-many) — DB Node.js + PHP
- Endpoint PUT /projects/:id/activities/:activityId/referenti per assegnare referenti specifici dell'attività
- I referenti aggiunti all'attività diventano automaticamente anche referenti del progetto
- ActivityDataBox: nuovo toggle "Referenti" stile ProjectDataBox con assegnazione/rimozione/creazione
- Lista referenti attività indipendente da quella di progetto

## V5.9.04-0411 — 15 Aprile 2026
- ActivityDetail "Email Attività": redesign stile ProjectDetail con direction tabs (In arrivo/Inviate), sub-filtri (Tutte/Rilevanti/Di contesto/Bloccanti), bottone "Invia Mail" sull'header, righe espandibili

## V5.9.03-0411 — 11 Aprile 2026
- Client TicketForm: bottoni Invia e Annulla affiancati a metà larghezza, Annulla torna a /client/tickets

## V5.9.02-0411 — 11 Aprile 2026
- Client portal: banner "Progetto/Attività bloccata" nascosti agli utenti senza accesso ai progetti

## V5.9.01-0411 — 11 Aprile 2026
- EmailInbox layout: Modifica sulla stessa riga dell'oggetto, Rispondi/Rispondi a tutti su riga 2, marcature (Bloccante/Rilevante/Di contesto) su riga 3

## V5.9.00-0411 — 11 Aprile 2026
- EmailInbox: IMAP estrae TUTTI i destinatari TO + CC (non solo il primo) — Node.js + PHP
- EmailInbox: layout ristrutturato con oggetto su riga dedicata e bottoni su righe sotto
- EmailInbox: nuovo bottone "Rispondi a tutti" (indigo) accanto a "Rispondi"
- EmailInbox: fix reply — attivita_id ora preservata nella risposta
- EmailInbox: reply mostra "A:" con lista destinatari effettivi

## V5.8.02-0411 — 11 Aprile 2026
- ProjectDataBox: toggle Tecnici visibile anche per tecnico (readonly, nomi da attività come fallback)

## V5.8.01-0411 — 11 Aprile 2026
- HelpTip su Chat Progetto: "La chat coinvolge tutti i tecnici abilitati al progetto"

## V5.8.00-0411 — 11 Aprile 2026
- Dashboard tecnico: 4 stat card (Ticket Aperti, Ticket Chiusi, Attività Aperte, Attività Chiuse)
- Dashboard tecnico: sezione "Scadenze da rispettare" con lista ordinata per urgenza
- Scadenze: colori rosso (scaduta/oggi), arancione (3gg), giallo (7gg), grigio (oltre)
- Scadenze: include attività con data_scadenza + ticket con SLA/data_evasione
- Ogni riga è un link al ticket o attività, con cliente e progetto
- Backend: nuovi campi tecnico-specifici in /api/dashboard (Node.js + PHP)

## V5.7.03-0411 — 11 Aprile 2026
- Rimosso box "Dipendenze" dalla sidebar destra ActivityDetail (ora nel toggle ActivityDataBox)

## V5.7.02-0411 — 11 Aprile 2026
- ActivityDataBox dipendenze: figli mostrano "In Attesa" se padre non completato

## V5.7.01-0411 — 11 Aprile 2026
- ActivityDataBox: toggle "Attenzione Dipendenze" (se ha padre) o "Attività Padre" (se ha solo figli), allineato a destra
- Pannello dipendenze: mostra padre (link arancione) e figli (link blu) con badge stato

## V5.7.00-0411 — 11 Aprile 2026
- Email threading progetto/attività: tag [PRJ-{id} ACT-{id}] aggiunto al subject in uscita
- IMAP poller: auto-match reply con tag PRJ/ACT, assegna automaticamente cliente/progetto/attività
- Implementato su entrambi i backend (Node.js + PHP) e su entrambi gli IMAP poller

## V5.6.04-0411 — 11 Aprile 2026
- Fix crash ActivityDataBox: residui showDescrizione/showTecnici rinominati in openPanel

## V5.6.03-0411 — 11 Aprile 2026
- Tecnico sidebar: ripristinati nomi "Timeline Progetti" e "Elenco Attività"

## V5.6.02-0411 — 11 Aprile 2026
- ProjectDataBox + ActivityDataBox: pannelli toggle mutuamente esclusivi (clicca uno, gli altri si chiudono)

## V5.6.01-0411 — 11 Aprile 2026
- ActivityDataBox redesign stile ProjectDataBox: Box 1 (header + progress + date) + Box 2 (toggle Descrizione, Allegati, Tecnici)

## V5.6.00-0411 — 11 Aprile 2026
- Nuovo componente ActivityDataBox: box header attività riutilizzabile (titolo, descrizione, priorità, stato, avanzamento, date, allegati)
- ActivityDetail refactored per usare ActivityDataBox

## V5.5.24-0411 — 11 Aprile 2026
- ActivityDetail: HelpTip su "Assegna a" — "Una attività può avere più tecnici abilitati"

## V5.5.23-0411 — 11 Aprile 2026
- ActivityDetail assegnazione: ignora tecnici_ids con ID utenti inesistenti/cancellati

## V5.5.22-0411 — 11 Aprile 2026
- ActivityDetail: tendina "Assegna a" filtrata per soli tecnici attivi (admin escluso)

## V5.5.21-0411 — 11 Aprile 2026
- Fix invio email tecnico: colonna errata tecnico_id → utente_id nella query progetto_tecnici (emails.php)

## V5.5.20-0411 — 11 Aprile 2026
- Pallini filtro tecnici: admin escluso in tutte le pagine (ProjectDetail, AllActivities)
- Query attività: aggiunto assegnato_ruolo per filtrare admin dai pallini (Node.js + PHP)
- TicketDetail: assegnazione mostra utente corrente anche se non tecnico (backward compat)

## V5.5.19-0411 — 11 Aprile 2026
- Chat progetto: cestino per eliminare singoli messaggi (solo admin, visibile su hover)
- Endpoint DELETE /api/projects/:id/chat/:messageId (Node.js + PHP, admin only)

## V5.5.18-0411 — 11 Aprile 2026 (Consolidamento sessione)
Riepilogo completo delle modifiche della giornata (V5.3.01 → V5.5.18):

### Security (V5.4.00)
- XSS: sanitizeHtml() in EmailInbox per email HTML
- CORS: whitelist localhost nel backend Node.js
- Migration: fix_referenti.php usa MIGRATE_KEY + flag file
- config.enc rimosso dal tracking git
- Service worker v2: cancella cache vecchie, esclude risorse esterne

### Ruolo Tecnico — UX completa (V5.4.01–V5.4.28)
- Gestione avanzata: tecnico con flag può caricare allegati e gestire referenti (prop canEdit in ProjectDataBox)
- Fix compatibilità PHP string IDs: Number() cast su tutti i confronti (tecnici, dipendenze, pallini)
- Pallini filtro tecnici estratti dalle attività (non da /api/users admin-only)
- Avanzamento % editabile dal tecnico sulle attività assegnate
- Dipendenze visibili in sola lettura
- AllActivities accessibile al tecnico (filtrato per progetti assegnati), auto-filtro per sé + solo aperte
- SendMail: tecnico senza parametri vede "Non autorizzato"; con parametri: tendine readonly, solo referenti
- Sidebar: label personalizzate (Ticket assegnati, Progetti visibili, Attività visibili)
- Titoli pagina: "di cui hai visibilità" con HelpTip esplicativo
- Ticket: tendina "Assegna a" mostra solo tecnici attivi

### Navigazione (V5.4.13–V5.4.22)
- ActivityDetail: link "torna" dinamico (Gantt / Dettaglio Progetto / Tutte le Attività) via React Router state
- Link "Vai a dettaglio progetto" nella pagina Gantt
- Link "Invia Mail" da ActivityDetail/ProjectDetail passa cliente_id nei parametri URL

### Dipendenze Attività (V5.5.00–V5.5.17)
- Stato "In Attesa" grigio per attività con dipendenza non completata, non modificabile
- Completamento padre: auto-release dipendenza (dipende_da=NULL) sui figli
- Assegnazione dipendenza: data inizio auto = data fine padre (creazione + modifica)
- Data inizio bloccata se ha dipendenza
- Dipendenza prima delle date nel popup nuova attività
- Numerazione sincronizzata con Gantt (per data_inizio)
- Gestione dipendenze circolari
- HelpTip su Dipendenza

### Auto-Fix Scadute (V5.5.12–V5.5.14)
- All'apertura: aggiorna date attività scadute e cascata sui dipendenti
- Popup avviso con date rosse differenziate (fine per scadute, inizio per dipendenti)

### Avanzamento Automatico (V5.4.04–V5.4.08)
- Completata → 100%, Riaperta → 0%

### Admin Sidebar Theme (V5.5.00)
- 7 temi colore per sidebar admin (gray, slate, zinc, indigo, teal, rose, amber)

### Deploy Smart (V5.4.00+)
- Confronto dimensioni file, version.json sempre caricato, cleanup-assets.js, riepilogo deploy
- 214 asset obsoleti eliminati dal server (119MB)

### Fix vari
- loadProject() inesistente in ProjectDetail → load()
- Riga separatrice tra filtri e lista attività
- buildTree: gestione cicli circolari
- Remote URL git corretto (Ticketing → ticketing)

## V5.5.17-0411 — 11 Aprile 2026
- TicketDetail: tendina "Assegna a" mostra solo tecnici attivi (escluso admin)

## V5.5.16-0411 — 11 Aprile 2026
- Cambio dipendenza attività esistente: data inizio aggiornata automaticamente alla data fine del padre

## V5.5.15-0411 — 11 Aprile 2026
- Tendina dipendenza: mostra #n con numero d'ordine Gantt (per data_inizio) al posto dell'ID o ordine DB

## V5.5.14-0411 — 11 Aprile 2026
- Fix date rosse: solo "Fine prevista" rossa per attività scadute, solo "Inizio" rosso per dipendenti (non la fine)

## V5.5.13-0411 — 11 Aprile 2026
- Completamento attività padre: rimuove automaticamente dipende_da dai figli (Node.js + PHP, tecnico + admin)

## V5.5.12-0411 — 11 Aprile 2026
- Auto-fix attività scadute: all'apertura del progetto, aggiorna data fine prevista ad oggi per attività non terminate con data passata
- Cascade: aggiorna data inizio delle attività dipendenti
- Popup di avviso "Attenzione: attività non terminate! Le date sono state modificate"
- Date modificate evidenziate in rosso (font-semibold text-red-600)

## V5.5.11-0411 — 11 Aprile 2026
- Nuova attività: data inizio bloccata (readonly grigio) quando ha una dipendenza

## V5.5.10-0411 — 11 Aprile 2026
- Nuova attività popup: "Dipende da" spostato prima delle date
- Selezione dipendenza imposta automaticamente data inizio = data fine dell'attività padre

## V5.5.09-0411 — 11 Aprile 2026
- ProjectDetail: attività ordinate per numero d'ordine Gantt (data_inizio)

## V5.5.08-0411 — 11 Aprile 2026
- ProjectDetail: numerazione attività sincronizzata con Gantt (basata su data_inizio)
- Cambio ordine con popup di conferma: "la data di inizio verrà modificata"
- Ricalcolo data_inizio automatico per mantenere coerenza con il nuovo ordinamento

## V5.5.07-0411 — 11 Aprile 2026
- ProjectDetail: badge "In Attesa" allineato a destra con gli altri stati (spostato nel div azioni)

## V5.5.06-0411 — 11 Aprile 2026
- Attività con dipendenza non completata: stato "In Attesa" grigio, non modificabile, bordo grigio, sfondo grigio chiaro
- Select stato e avanzamento nascosti quando attività è in attesa della dipendenza

## V5.5.05-0411 — 11 Aprile 2026
- ProjectDetail: HelpTip su Dipendenza attività (admin e tecnico)

## V5.5.04-0411 — 11 Aprile 2026
- ProjectGantt: link "Vai a dettaglio progetto" dopo il titolo

## V5.5.03-0411 — 11 Aprile 2026
- ProjectDetail: riga separatrice tra filtri attività e lista attività

## V5.5.02-0411 — 11 Aprile 2026
- Fix rientri dipendenze: gestione dipendenze circolari in buildTree (spezza il ciclo al nodo con ordine più basso)

## V5.5.01-0411 — 11 Aprile 2026
- Fix rientri dipendenze in ProjectDetail: Number() cast su id/dipende_da per compatibilità PHP string IDs con Set.has()

## V5.5.00-0411 — 11 Aprile 2026
- Admin sidebar: tema colori personalizzabile con 7 colori (gray, slate, zinc, indigo, teal, rose, amber)
- Riquadri colorati in basso nella sidebar per cambiare tema, salvato per utente in localStorage
- Colori applicati a sfondo, bordi, link attivi e hover

## V5.4.28-0411 — 11 Aprile 2026
- Tecnico Timeline: titolo aggiornato a "Timeline dei Progetti di cui hai visibilità"

## V5.4.27-0411 — 11 Aprile 2026
- Tecnico sidebar: label rinominate (Ticket assegnati, Progetti visibili, Attività visibili)

## V5.4.26-0411 — 11 Aprile 2026
- Tecnico TicketList: titolo "Ticket a te assegnati"

## V5.4.25-0411 — 11 Aprile 2026
- Tecnico Timeline: titolo "Progetti di cui hai visibilità" con HelpTip esplicativo su abilitazione tecnici

## V5.4.24-0411 — 11 Aprile 2026
- Fix titolo AllActivities tecnico: "Elenco Tutte le Attività dei Progetti di cui hai visibilità"

## V5.4.23-0411 — 11 Aprile 2026
- Tecnico: titolo "Timeline Progetti di cui hai visibilità" e "Elenco Attività di cui hai visibilità"

## V5.4.22-0411 — 11 Aprile 2026
- ActivityDetail: link "torna" gestisce anche provenienza Gantt (state from:'gantt')
- GanttChart: click su attività passa state from:'gantt' per navigazione di ritorno

## V5.4.21-0411 — 11 Aprile 2026
- AllActivities: filtro "Solo Aperte" / "Tutte" con bottoni toggle
- Tecnico: pagina si apre con filtro automatico per sé stesso + solo aperte

## V5.4.20-0411 — 11 Aprile 2026
- AllActivities: filtro per tecnico con pallini cliccabili (stesso stile ProjectDetail)

## V5.4.19-0411 — 11 Aprile 2026
- SendMail: tecnico senza parametri URL vede messaggio "Non autorizzato — parti da una attività"

## V5.4.18-0411 — 11 Aprile 2026
- SendMail: nota destinatari sempre visibile sopra la lista contatti

## V5.4.17-0411 — 11 Aprile 2026
- SendMail da attività: destinatari limitati ai soli Referenti (esclusi utenti portale)
- Testo descrittivo aggiornato con nota "Solo i Referenti se si arriva da una attività"

## V5.4.16-0411 — 11 Aprile 2026
- SendMail: rimossa email cliente dai destinatari, restano solo referenti progetto e utenti portale (admin)

## V5.4.15-0411 — 11 Aprile 2026
- Fix SendMail per tecnico: carica progetto direttamente via API (non serve clients.list admin-only)
- Tendine pre-compilate mostrate come testo readonly (non select), con nomi da projectDetail

## V5.4.14-0411 — 11 Aprile 2026
- SendMail: tendine cliente/progetto/attività pre-compilate e bloccate quando si arriva con parametri URL
- SendMail: fix race condition che resettava i campi pre-compilati
- Link "Invia Mail" da ActivityDetail e ProjectDetail ora passa anche cliente_id

## V5.4.13-0411 — 11 Aprile 2026
- ActivityDetail: link "torna" dinamico — se arrivi da AllActivities torna lì, altrimenti torna al progetto
- AllActivities: passa state from:'all-activities' nel Link ad ActivityDetail

## V5.4.12-0411 — 11 Aprile 2026
- Fix AllActivities pallino tecnico: aggiunto LEFT JOIN utenti per assegnato_nome nella query /activities/all (Node.js + PHP)

## V5.4.11-0411 — 11 Aprile 2026
- Fix pallino tecnico in AllActivities: Number() cast per compatibilità PHP string IDs

## V5.4.10-0411 — 11 Aprile 2026
- Fix AllActivities per tecnico: rimossa chiamata usersApi.list() (admin-only), pallini tecnici estratti dalle attività

## V5.4.09-0411 — 11 Aprile 2026
- Pagina "Tutte le Attività" accessibile al tecnico: mostra solo attività dei progetti assegnati (Node.js + PHP)

## V5.4.08-0411 — 11 Aprile 2026
- Riapertura attività: avanzamento resettato a 0% quando stato cambia da completata ad altro (Node.js + PHP, tecnico + admin)

## V5.4.07-0411 — 11 Aprile 2026
- Tecnico ProjectDetail: dipendenza attività visibile in sola lettura (nome attività padre)

## V5.4.06-0411 — 11 Aprile 2026
- Fix pallini tecnici per ruolo tecnico: estratti dalle attività del progetto (non da /api/users che è admin-only)
- Fix service worker v2: cancella cache vecchie, esclude risorse esterne (font Google)
- Fix CSP: aggiunto connect-src per fonts.googleapis.com
- Fix deploy smart: version.json sempre caricato (bypass check dimensione)

## V5.4.05-0411 — 11 Aprile 2026
- Tecnico ProjectDetail: pallini filtro tecnici ora visibili (userList caricata per tutti, non solo admin)
- Tecnico ProjectDetail: input avanzamento % editabile sulle attività assegnate (non solo testo readonly)
- Backend: tecnico può aggiornare avanzamento attività assegnate (Node.js + PHP)

## V5.4.04-0411 — 11 Aprile 2026
- Attività completata: avanzamento automatico a 100% quando stato diventa "completata" (Node.js + PHP, tecnico + admin)

## V5.4.03-0411 — 11 Aprile 2026
- Fix referenti ProjectDetail: loadProject() non esisteva, rinominato in load() — ora assegna/rimuovi/crea referente aggiorna la vista immediatamente

## V5.4.02-0411 — 11 Aprile 2026
- Fix gestione avanzata: confronto tecnici IDs con Number() per compatibilità PHP string vs JS number
- Fix link "Torna al progetto" in ActivityDetail: ora punta a /admin/projects/:id (dettaglio) invece di /gantt

## V5.4.01-0411 — 11 Aprile 2026
- Fix gestione avanzata progetti: tecnico con flag gestione_avanzata ora può caricare allegati e gestire referenti nel ProjectDataBox
- Nuova prop canEdit in ProjectDataBox, passata da ProjectDetail e ProjectGantt

## V5.4.00-0411 — 11 Aprile 2026
- Security: fix XSS in EmailInbox — sanitizeHtml() rimuove script/style/iframe/event handlers prima del rendering HTML email
- Security: fix_referenti.php ora usa MIGRATE_KEY dedicata + flag file _ENABLE_MIGRATE (come migrate.php)
- Security: CORS backend Node.js ristretto a localhost:5173/3000 (configurabile via ALLOWED_ORIGINS)
- Security: config.enc rimosso dal tracking git + aggiunto a .gitignore
- Pulizia: 214 file asset obsoleti rimossi da locale (119MB) e dal server Aruba
- Script deploy/cleanup-assets.js per pulizia FTP automatica asset vecchi

## V5.3.01-0411 — 11 Aprile 2026
- Aggiornamento completo README.md locale: allineato da V4.3.03 a V5.3.00 (nuove sezioni, funzionalità, schema DB, componenti)

## V5.3.00-0411 — 11 Aprile 2026
- Fix eliminazione cliente: riordinato cascade (email NULL prima di delete progetti/attività), tutti try/catch con Throwable, messaggio errore se fallisce

## V5.2.00-0409 — 9 Aprile 2026
- Componente ProjectDataBox: box standard riutilizzabile per header progetto + toggle (descrizione, allegati, referenti, tecnici, nuova attività)
- ProjectDataBox usato in ProjectDetail, ProjectGantt e ClientProjectDetail — una modifica aggiorna tutte le pagine
- Descrizione progetto spostata nel toggle box come espandibile, rimossa dal titolo
- Matita per modificare nome progetto inline (solo admin)
- Popup "Nuova Attività" integrato nel ProjectDataBox, rimosso form inline e link Aggiungi dal tab attività
- Componente ProjectMiniBox: card progetto standard con data aggiornamento (pallino verde/giallo/grigio), "Cliente:" prefix
- Nuova pagina "Tutte le Attività" (/admin/all-activities): tabella con Azienda, Titolo (ordina per progetto), Ordine (calcolato da dipendenze), Fine prevista, Tecnico (pallino), Avanzamento
- Endpoint /api/activities/all (Node.js + PHP) per lista attività cross-progetto
- Filtro tecnici pallini nella lista attività del ProjectDetail
- Filtro email per numero attività nel Gantt
- Email editing rich text: B/I/U, colori rosso/blu/nero, evidenzia giallo, pulisci formattazione
- Email corpo/oggetto modificabili e salvabili nel DB (backend PUT aggiornato)
- Gantt/Timeline: primo mese visibile = mese corrente, auto-scroll alla linea "oggi"
- Eliminazione cliente con cascade completa (progetti, attività, ticket, utenti, referenti, email)
- Campo Cognome aggiunto a utenti_cliente (DB + frontend + backend)
- Popup utente unificato admin/client con Nome, Cognome, Email su 3 colonne
- Popup referente in modale con datalist ruoli
- Paginazione 5/pagina per tabelle Utenti Portale e Referenti nel ClientDetail
- Select multipla referenti (>4) nel popup nuovo progetto
- Login page: credenziali admin aggiornate, rimossa demo, "Sito Operativo"
- Fix: referenti X non funzionante (rimossa condizione count>0 in PHP)
- Fix: tecnici panel vuoto in ProjectDetail (IDs vs oggetti)
- Fix: "0" dopo badge Ricevuta email (!!is_bloccante)
- Fix: bcrypt $2y/$2a incompatibilità PHP/Node.js
- Client project detail: box email al posto delle attività
- HelpTip su gestione avanzata progetti

## V5.1.01-0407 — 7 Aprile 2026
- PWA: manifest.json, service worker, meta Apple per installazione su iPhone
- Mobile admin: sidebar hamburger slide-in, top bar con menu button
- Mobile admin: ticket list card compatte, tabella nascosta
- Mobile admin: HelpTip nascosti, toggle estesa/compatta nascosti (sempre estesa)
- Mobile admin: pallini stato compatti senza label, footer responsive
- Mobile admin: email dettaglio popup fullscreen invece di pannello laterale
- Email dettaglio: tendina progetti filtrata per cliente selezionato (desktop + mobile)
- Fix config.enc locale: password assistenzatecnica@ aggiornata per evitare sovrascrittura al deploy
- Fix cambio password non richiesto: conversione Number() per cambio_password da PHP
- Fix cambio lingua senza logout: aggiornamento sessionStorage + reload automatico

## V5.1.00-0406 — 6 Aprile 2026
- Ticket client dettaglio: layout 2 colonne stile admin, "Rispondi alla Assistenza", blocco se risolto
- Ticket client dettaglio: sidebar con "Raccolta Allegati" (compattabile) e "Chat Interna" con filtro LastMSG/Story
- Chat Interna ticket: nuova tabella chat_ticket_interna, endpoint GET/POST, visibile solo lato client
- Chat Interna: notifica email ai partecipanti via noreply (non salvata nel thread), bordo verde
- Ticket client: filtro "Solo Ultimo" per mostrare solo l'ultimo messaggio nella conversazione
- Ticket client reply: email automatica a tutti i partecipanti + admin + tecnico assegnato
- Ticket admin: ordinamento cliccabile su tutte le colonne (Codice, Oggetto, Cliente, Priorità, Assegnato, Data, Updated, Evasione)
- Ticket admin/client: filtro stati multipli selezionabili contemporaneamente (backend supporta CSV)
- Ticket client: alert "Ticket in attesa" nella top bar, refresh immediato dopo reply
- Ticket admin/client: auto-refresh thread ogni 30s
- Ticket client: mark email admin come lette all'apertura (fix cerchio rosso MSG)
- Ticket: conteggio partecipanti esclude indirizzi di sistema
- Thread messaggi: indicazione Owner/Partecipante + msg da Portale/Reply email
- Email reply admin: testo cambiato in "Ecco la risposta di STM Domotica"
- Popup utente admin/client unificato: stessa struttura, 540px, Ruolo fisso User lato client
- Popup utente: aggiunto servizio "Progetti STM", HelpTip su "Servizi Visibili"

## V5.0.01-0406 — 6 Aprile 2026
- Progetti lista: badge "STM Domotica" blu sui progetti manutenzione ordinaria
- Ticket client: email admin marcate come lette quando il cliente apre il ticket (fix cerchio rosso MSG)

## V5.0.00-0405 — 5 Aprile 2026
- Nuovo servizio "Progetti STM": campo servizio_progetti_stm su clienti, controlla visibilità progetti manutenzione ordinaria nel portale cliente
- ClientDetail: box Servizi Attivi con 4 checkbox (Ticket, Progetti, AI, Progetti STM), pulsante Salva, HelpTip dedicato
- ClientDetail: HelpTip su "Utenti Portale" e "Anagrafica Referenti Progetti"
- ClientDetail: badge schede rossi per servizi disattivati a livello azienda, HelpTip su colonna Schede
- ClientList estesa: box uniformati stessa altezza, layout ristrutturato (nome, referente, indirizzo, telefono, note), "Servizi Attivi X/4"
- ClientList: testo corsivo "Clicca sul cliente per modificare"
- Migrazione DB: colonna servizio_progetti_stm su clienti (Node.js + MySQL)
- Backend: filtro progetti manutenzione_ordinaria in base a servizio_progetti_stm (Node.js + PHP)

## V4.9.00-0404 — 4 Aprile 2026
- Portale cliente sidebar: logo grande + versione/data/orologio su 2 colonne, bandierina lingua, 7 colori tema con contorno bianco
- Ticket client: colonna "Msg" con conteggio messaggi e cerchio rosso per non letti (solo risposte admin inviate)
- Ticket client: colonna "Riapri" per ticket risolti/chiusi, link al dettaglio con reopen
- Ticket client dettaglio: header unificato stile admin (codice+data, oggetto, categoria+priorità, evasione, partecipanti con HelpTip)
- Ticket client dettaglio: viste Estesa/Compatta con LAST MSG e ordinamento Vecchi/Nuovi
- Ticket admin dettaglio: ordinamento Vecchi/Nuovi nel thread messaggi
- Ticket admin dettaglio: header ristrutturato (codice + "aperto il giorno" + data, priorità spostata dopo categoria)
- Ticket admin: blocco risposta su ticket risolto con messaggio "Ticket risolto — non è possibile scrivere messaggi"
- Ticket riapertura: data_evasione cancellata (NULL) sia da reply client che da cambio stato admin
- Progetti lista: popup "Nuovo Progetto" identico stile Timeline, allargato max-w-3xl
- Progetti popup: Manutenzione Ordinaria sempre visibile in alto con HelpTip, Tecnici e Referenti su 2 colonne
- Clienti lista: testo corsivo "Clicca sul cliente per modificare"
- Clienti dettaglio: checkbox "Servizi Attivi" spostati sotto il box Logo in card dedicata
- Delete utente: gestione completa FK (ticket, attività, note, email, notifiche, chat, allegati)

## V4.8.00-0403 — 3 Aprile 2026
- Sidebar admin: voce "Progetti" espandibile con sottomenu "Timeline Progetti"
- ProjectDetail: header unificato stile Gantt (descrizione inline, barra avanzamento, date, link)
- ProjectDetail: titolo "Dettaglio Progetto" + badge Attive/Completate + link "Vai a visualizzazione Gantt"
- ProjectGantt: titolo rinominato "Dettaglio Progetto : Gantt Chart"
- Dashboard admin: 3 box prima riga stessa altezza
- Dashboard admin: attività programmate esclude quelle scadute (data < oggi)
- ClientList compatta: righe whitespace-nowrap per altezza uniforme con UserList
- Delete utente: riassegna tutte le FK (ticket, attività, progetti, note, allegati, notifiche, chat, email) prima di eliminare
- Ticket client form: HelpTip su "Ticket privato" con spiegazione visibilità colleghi
- Ticket client lista: colonna rinominata "Partecipanti" con ? prima del titolo
- Email Inbox: IMAP polling triggerato ad ogni apertura pagina Email
- Email Inbox: pulsante "Sblocca progetto" (rosso → verde) visibile solo su progetti bloccati da email
- IMAP: password assistenzatecnica@ aggiornata nel config.enc cifrato
- Noreply email: ora invia via ticketing@ con nome mittente "Noreply STM Domotica"
- Logo STM copiato in uploads/ per embedding nelle email
- Portale cliente: alert rossi "Attività bloccata" / "Progetto bloccato" nella top bar
- Rate limiter login ridotto a 200 secondi
- Eliminati 115 FAQ Suprema dal repository locale + 111 da produzione
- Media messaggi per ticket nella dashboard cliente admin

## V4.7.00-0402 — 2 Aprile 2026
- Portale cliente: redesign completo con sidebar a sinistra (stile admin)
- Sidebar grigio scuro (bg-gray-700) differenziato dall'admin (bg-gray-900)
- Logo cliente in alto a sinistra nel sidebar, nome azienda + versione
- Top bar sticky con campanella comunicazioni (dropdown) e banner nuova versione
- Rimossa pubblicità STM Domotica (LinkedIn, sito web, certificazioni)
- Rimosso footer STM e Teams FAB
- Ticket client: redesign stile admin con pallini stato cliccabili, percentuali, paginazione 10 righe + anno
- Ticket client: colonne Codice, Oggetto, Priorità, Creato, Updated, Evaso, Altri (partecipanti)
- Ticket client: filtro "Solo miei", ricerca, sfondo verde/grigio per risolti/chiusi
- Ticket client: conteggio partecipanti (COUNT DISTINCT mittente) da backend Node.js + PHP
- Dashboard client: rimossi ticket recenti
- Utenti client: tabella full width, form creazione/modifica in popup modale
- Sidebar tema personalizzabile: 5 colori scuri (gray, slate, zinc, indigo, teal) salvati per utente in localStorage
- Rate limiter login ridotto da 900s a 200s (admin + client, Node.js + PHP)
- Media messaggi per ticket nella dashboard cliente admin (N.MedioMsg)
- Email inbox: dropdown cliente per assegnazione manuale nel pannello dettaglio
- IMAP auto-match: aggiunto referenti_progetto.email
- Dashboard email gestite: corretta query (escluse email ticket)

## V4.6.01-0401 — 1 Aprile 2026
- SendMail: tendina Cliente obbligatoria, filtra progetti e attività a cascata
- SendMail: tendine una sotto l'altra a metà larghezza, testo corsivo descrittivo di fianco al titolo
- SendMail: footer disclaimer incancellabile sotto textarea, aggiunto automaticamente al corpo email
- SendMail: HelpTip su checkbox Email bloccante
- Email BCC: riccardo@stmdomotica.it in copia nascosta su tutte le email da assistenzatecnica@ (Node.js + PHP)
- Email Inbox: dropdown Cliente nel pannello dettaglio per assegnazione manuale
- Email Inbox: testo descrittivo corsivo di fianco al titolo
- Dashboard email gestite: corretta query (escluse email ticket, conta solo assistenzatecnica@)
- Dashboard ticket recenti: query aggiornata con assegnato_nome, sla_reazione, updated_at
- Banner cliente uniformato anche in ClientDashboard
- IMAP auto-match: aggiunto match su referenti_progetto.email
- ClientDashboard: fix useState dentro IIFE, tabella ticket con pallini/filtri/paginazione/anno

## V4.6.00-0401 — 1 Aprile 2026
- Allegati attività: nuova tabella allegati_attivita con upload/download/delete
- Backend Node.js + PHP: endpoint CRUD allegati attività con multer (25MB, 10 file)
- Frontend ActivityDetail: sezione allegati espandibile con upload drag&drop
- ProjectGantt header: descrizione inline con "Descrizione:" in corsivo, date progetto, rimossa "Descrizione Breve" toggle
- ActivityDetail header: uniformato a ProjectGantt (titolo grande, descrizione, barra avanzamento, date, allegati)
- Migrazione PHP: CREATE TABLE allegati_attivita su MySQL produzione

## V4.5.00-0331 — 31 Marzo 2026
- Ticket: colonna Stato rimossa, pallini colorati cliccabili per filtrare per stato con percentuali
- Ticket: colonna Updated (tempo relativo dall'ultimo aggiornamento)
- Ticket: SLA cliente in rosso bold tra parentesi, evasione verde/rosso in base a SLA
- Ticket: paginazione 10 righe + navigazione anno al centro del footer
- Ticket: sfondo verde per risolti, grigio per chiusi
- Ticket: ricerca estesa anche nel testo/descrizione del ticket
- Ticket: stato "Chiuso" rimosso dal dropdown — solo il cliente può chiudere
- Ticket: stati automatici (Aperto→In lavorazione su assegnazione/nota/risposta)
- Ticket: data evasione impostata automaticamente alla risoluzione
- Ticket: titolo "Gestione Ticket" + banner "Cliente: NomeAzienda" uniformato
- Email Inbox: filtro per direzione (Ricevute/Inviate) basato su campo `direzione`
- Email Inbox: badge verde "Inviata" / viola "Ricevuta", nome tecnico per email inviate
- Email Inbox: prefisso "Da:" e "Cliente:"/"Dest.Cliente:" nella lista
- SendMail: fix crash (projectsApi.list ritorna oggetto non array), reset completo campi dopo invio
- Comunicazioni: voce "TUTTI" nella tendina destinatario per invio a tutti i clienti
- Comunicazioni: paginazione 10 righe + navigazione anno (come Ticket)
- HelpTip: componente tooltip "?" viola su hover per tutte le pagine principali
- HelpTip posizionati su: Dashboard, Ticket, TicketDetail (thread, risposta, note, AI, partecipanti, stato, in attesa, KB), Email, SendMail, ProjectDetail, ActivityDetail, Repository, Comunicazioni, UserList (AI, AP)
- UserList compatta: colonne AI e AP (read-only) con HelpTip esplicativi
- Banner cliente uniformato (p-3, w-8 h-8) su TicketDetail, ProjectDetail, ProjectGantt, ActivityDetail
- Login: pulizia sessionStorage su mount (useEffect) per fix primo tentativo
- Pagination: sempre visibile anche con 1 sola pagina
- Fix .htaccess: rimosso blocco generico .json per version.json

## V4.4.00-0331 — 31 Marzo 2026
- Nuova pagina "Invia Mail" nel menu sidebar (admin + tecnico)
- Selezione progetto/attività obbligatoria prima dell'invio, con filtro progressivo
- Destinatari proposti da referenti progetto, email cliente e utenti portale (checkbox multi-select)
- Email inviate salvate in DB con campo `direzione` (ricevuta/inviata) e `inviata_da`
- Tab "In arrivo" / "Inviate" nelle sezioni email di ProjectDetail e ActivityDetail
- Bottone "Invia Mail" nelle sezioni email di progetto e attività con link pre-compilato
- Tecnico può inviare email su progetti assegnati (non solo ticket)
- Fix .htaccess: rimosso blocco generico .json, protetti solo file sensibili specifici
- Client UserManagement: cestino e modifica visibili per tutti gli utenti (non solo non-admin)
- Backend: eliminazione utente admin portale permessa se non ultimo admin
- Fix: aggiunte funzioni getProjectReferenti/setProjectReferenti mancanti in Node.js
- Referenti inclusi nella risposta GET progetto dettaglio (Node.js)
- Tabella utenti client: ridotta a 6 colonne con layout table-fixed

## V4.3.03-0324 — 24 Marzo 2026
- Fix login primo tentativo: pulizia sessionStorage prima del login (admin + client)

## V4.3.02-0323 — 23 Marzo 2026
- Gantt: frecce dipendenze linea continua con freccia più visibile
- Gantt: fix routing frecce per barre sovrapposte (detour path)

## V4.3.01-0323 — 23 Marzo 2026
- Gantt: legenda colori (In corso, Da fare, Terminata, Bloccata) allineata a destra nella riga filtri
- Fix dipendenze circolari: protezione nel drag&drop che impedisce di creare dipendenze circolari

## V4.3.00-0323 — 23 Marzo 2026
- Flag "Gestione avanzata progetti" su tabella utenti (default 0)
- Checkbox in creazione e modifica tecnico (estesa + compatta)
- Upload allegati e gestione referenti condizionati dal flag gestione_avanzata
- Tecnico senza flag: vede allegati e referenti in sola lettura
- Tecnico con flag: può caricare allegati, aggiungere/rimuovere referenti
- GET referenti cliente accessibile ai tecnici assegnati a progetti del cliente

## V4.2.01-0323 — 23 Marzo 2026
- Tecnico abilitato al progetto: può caricare allegati, aggiungere/rimuovere referenti
- Nuovo endpoint `PUT /api/projects/:id/referenti` per admin + tecnico assegnato
- Upload allegati: rimosso requireAdmin, check assegnazione progetto per tecnico
- Fix date attività programmate: validazione anno 00xx → 20xx (Node.js + PHP)

## V4.2.00-0323 — 23 Marzo 2026
- Ticket privato: campo `privato` su tabella ticket, checkbox nella creazione ticket client
- Backend: ticket privati filtrati nella lista e dettaglio client (visibili solo al creatore)
- Protezione URL diretto: utente non può aprire ticket privato di un altro
- Traduzioni i18n per ticket privato (IT/EN/FR)
- Migrazione DB: colonna `privato` su tabella ticket

## V4.1.09-0322 — 22 Marzo 2026
- Creazione progetto: checkbox "Progetto singola attività" sopra le date (Timeline + ProjectList)

## V4.1.08-0322 — 22 Marzo 2026
- Fix cancellazione progetti: reset dipende_da prima di delete attività (FK constraint)
- Fix cancellazione progetti: aggiunto UPDATE ticket SET progetto_id = NULL

## V4.1.07-0322 — 22 Marzo 2026
- Version check: banner "Nuova versione disponibile" con bottone Aggiorna (admin + client)
- Controllo automatico ogni 60 secondi tramite version.json
- Plugin Vite per generare version.json durante il build

## V4.1.06-0322 — 22 Marzo 2026
- Email Inbox: cestino per eliminare email (admin)
- Endpoint DELETE /api/emails/:id (Node.js + PHP)
- Fix cancellazione progetti: aggiunto delete di attivita_programmate, email attività, email progetto, note_interne

## V4.1.05-0321 — 21 Marzo 2026
- Gantt: attività ordinate per data inizio, numerazione dinamica aggiornata dopo drag

## V4.1.04-0321 — 21 Marzo 2026
- Gantt drag&drop: trascinare bordi per cambiare date inizio/fine, centro per spostare barra
- Gantt drag su altra barra: crea dipendenza automatica
- Feedback visuale: bordo blu durante drag, highlight giallo su barra target per dipendenza
- Solo admin può trascinare le barre

## V4.1.03-0321 — 21 Marzo 2026
- Gantt: numerazione tutte le attività in ordine cronologico per data inizio

## V4.1.02-0321 — 21 Marzo 2026
- Gantt: numerazione attività indipendenti per ordine data inizio, quadratino colorato per dipendenti
- Azioni attività: box collassabile con triangolino

## V4.1.01-0321 — 21 Marzo 2026
- Dettaglio attività: cestino per eliminare attività (solo admin) con redirect al progetto

## V4.1.00-0321 — 21 Marzo 2026
- Dashboard admin: rimossi ticket urgenti, ticket recenti, scadenze imminenti
- Dashboard admin: calendario con pallini rossi per attività programmate di tutti i progetti
- Dashboard admin: click su giorno mostra dettaglio con link a progetto/attività
- Dashboard admin: box calendario e carico tecnico collassabili con triangolino
- Dettaglio attività: matita per modifica nome, descrizione, priorità, date (solo admin)
- Modale modifica attività con tutti i campi

## V4.0.01-0321 — 21 Marzo 2026
- Attività: tutti i box partono compatti di default
- Email Associate si apre automaticamente solo se esiste email bloccante
- Gantt: pallini rossi sulle barre per attività programmate
- Backend: attivita_programmate incluse nella response GET progetto (Node.js + PHP)

## V4.0.00-0321 — 21 Marzo 2026
- Email associate attività: blocco sempre visibile anche senza email, con triangolino collapsabile
- Messaggio "Nessuna email associata" quando vuoto

## V3.9.00-0321 — 21 Marzo 2026
- Attività programmate: nuova tabella `attivita_programmate` con nota, data, referenti
- Calendario mini nella sidebar attività con pallini rossi sui giorni con eventi
- Popup giorno: mostra attività programmate con nota, referenti, autore
- Form creazione: testo, data, selezione referenti progetto (solo admin)
- Eliminazione attività programmate con conferma
- Thread Email ticket: vista Estesa/Compatta con toggle, vista compatta con righe e triangolino
- Dipendenze attività: spostato nella sidebar destra con triangolino collapsabile
- Endpoint CRUD scheduled: GET/POST/DELETE su Node.js + PHP

## V3.8.00-0320 — 20 Marzo 2026
- Fix email tecnico: tecnico può inviare risposte sui ticket assegnati (rimosso requireAdmin)
- Pulizia dist/assets: cancellati 130 file JS/CSS vecchi dal server (da 130 a 2)
- Filtri veloci ticket: bottoni "Aperti", "Chiusi", "Tutti" nella pagina ticket admin
- Filtro cliente visibile anche per tecnico (estrae clienti dai ticket)
- Partecipanti ticket: sezione espandibile con elenco email partecipanti (admin + tecnico)
- Grid filtri ticket adattato per tecnico (4 colonne con cliente)

## V3.7.01-0320 — 20 Marzo 2026
- Titolo tab browser: "STM-Portal" (login), "STM-Portal : admin/tecnico/client/user" (dopo login)
- Ticket dettaglio tecnico: nascosto "Assegna a" (solo admin), nascosto "Assistente AI" se tecnico non abilitato AI
- Fix rendering "0" nel box AI quando abilitato_ai=0 (usato !! per boolean)
- Aggiornamento README.md e CLAUDE.md con versione corrente e nuove sezioni

## V3.7.00-0318 — 18 Marzo 2026
- Gestione tecnici nel dettaglio progetto (Gantt): toggle per assegnare/rimuovere tecnici
- Multi-tecnico per attività: dropdown con checkbox, campo `tecnici_ids`
- Accesso attività per tecnico: solo attività assegnate, pagina "Utente non abilitato" se non autorizzato
- Nomi tecnici visibili per tutti (anche tecnici non admin) tramite `tecnici_nomi` dal backend
- Knowledge Base checkbox nascosta per tecnici senza AI
- Default `abilitato_ai = 0` per nuovi tecnici, reset tutti i tecnici esistenti a 0
- Fix lista utenti: campo `abilitato_ai` incluso nella query GET

## V3.6.00-0318 — 18 Marzo 2026
- Abilitazione AI per tecnico: flag `abilitato_ai` su tabella utenti
- Checkbox "Abilita AI Assistant" nel form creazione e modifica tecnico (estesa + compatta)
- Menu AI admin nascosto per tecnici non abilitati
- Fix modifica utente in vista compatta: form inline sotto la riga con Salva/Annulla

## V3.5.00-0317 — 17 Marzo 2026
- Servizi per cliente: 3 flag (Ticket, Progetti, AI) configurabili in creazione e dettaglio cliente
- Portale client: menu e accesso pagine filtrati per servizi attivi del cliente
- Protezione URL diretto: redirect automatico se servizio disattivato
- Creazione utente portale (admin + client): checkbox disabilitate per servizi non attivi
- Pagina Utenti admin: toggle vista Estesa/Compatta (tabella)
- Pagina Clienti admin: toggle vista Estesa/Compatta (tabella con SLA, ticket, progetti)
- Migrazione DB: colonne servizio_ticket, servizio_progetti, servizio_ai su tabella clienti

## V3.4.03-0317 — 17 Marzo 2026
- AI: rimossi tutti i limiti di ricerca documenti (LIMIT e troncamento 2000 char)
- AI: carica tutti i documenti repository + tutte le FAQ Suprema ad ogni domanda (128K token Groq)
- Repository: fix allineamento colonne tabella (header/body)
- Repository: fix categoria editing (select parte da "Altro" per categorie non standard)
- Migrazione: rinominata categoria "generale" → "Altro"

## V3.4.02-0316 — 16 Marzo 2026
- Repository: colonna AI con spunta verde se testo estratto
- Repository: descrizione spostata sotto la riga con triangolino espandibile, modificabile con matita
- Repository: 3 categorie fisse (Accessi, TVCC, Altro) con select e filtri dedicati
- Repository: paginazione a 10 file per pagina

## V3.4.01-0316 — 16 Marzo 2026
- Pagina Utenti admin: bottone matita per modifica nome, email e password di ogni tecnico
- Form Nuovo Tecnico: checkbox "Richiedi cambio password al primo accesso"
- Login admin: schermata cambio password obbligatorio al primo accesso (come portale client)
- Endpoint `PUT /api/auth/change-password` per admin (Node.js + PHP)
- Migrazione DB: colonna `cambio_password` aggiunta a tabella `utenti`
- Dettaglio Progetto (Gantt): gestione referenti — aggiungi da elenco esistente, crea nuovo, rimuovi

## V3.4.00-0315 — 15 Marzo 2026
- AI referenze: sezione "📎 Fonti:" in fondo ad ogni risposta AI con elenco documenti utilizzati
- Fix overflow chat AI: testo lungo non esce più dalla finestra (admin, client, ticket)
- Libreria `smalot/pdfparser` installata su Aruba per estrazione testo PDF

## V3.3.02-0315 — 15 Marzo 2026
- PHP: estrazione testo PDF nel repository via `smalot/pdfparser` (prima solo .txt/.md)
- AI keyword search: mantiene trattini nei termini di ricerca, soglia abbassata a 3 caratteri (prima 4)
- Fix applicato su tutti gli endpoint AI (Node.js + PHP)
- Nota informativa nel box upload repository sui formati supportati dall'AI

## V3.3.01-0315 — 15 Marzo 2026
- Messaggio login errato: "Accesso Negato — Verifica i dati" (admin + client)
- Menu client admin: stessa dimensione dei menu user, allineato a destra
- Rimosso bottone "Accedi Ticketing/Progetti" dalla pagina dettaglio cliente admin
- Dashboard cliente: link "Progetti" apre Timeline filtrata per cliente
- Dashboard cliente: SLA assegnata nel box tempo medio gestione ticket
- Timeline: supporto parametro URL `?cliente=` per filtro preimpostato

## V3.3.00-0314 — 14 Marzo 2026
- CSP Google Fonts: aggiunto `fonts.googleapis.com` e `fonts.gstatic.com` ai Content-Security-Policy su tutti e 3 i livelli (.htaccess, Node.js, PHP)
- Fix Timeline: progetti "Senza Attività" ora visibili nel filtro "Aperti"
- Menu portale client su due righe: riga 1 per tutti (Ticket, Progetti, AI), riga 2 solo admin (Dashboard, Utenti)
- Rinominato "I Miei Ticket" → "Ticket" e "I Miei Progetti" → "Progetti" nel portale client (IT/EN/FR)

## V3.2.00-0314 — 14 Marzo 2026
- Dashboard cliente lato portale: nuova pagina `/client/dashboard` con torte ticket/email/progetti, tempi medi, ticket recenti
- Endpoint `GET /api/client-auth/dashboard` (Node.js + PHP), solo admin cliente
- Link Dashboard nel menu portale client (solo admin cliente)
- Filtro "Solo miei" nella lista ticket client: filtra per `creatore_email` dell'utente loggato
- Email di benvenuto automatica alla creazione utente cliente (admin + client, Node.js + PHP)
- Rimosso bottone "Dashboard Sistemi" dalla pagina login clienti
- Traduzioni i18n IT/EN/FR per dashboard e filtro

## V3.1.04-0314 — 14 Marzo 2026
- Fix posizione banner sicurezza AI: ora dentro la colonna chat (stessa larghezza) sia lato admin che client

## V3.1.03-0314 — 14 Marzo 2026
- Titolo "Dettaglio Progetto" nella pagina progetto singolo (ProjectGantt)
- Titolo "Dettaglio Attività" nella pagina attività singola (ActivityDetail) con sottotitolo progetto + nome attività
- Banner sicurezza AI spostato sotto la chat nella pagina admin AI
- Banner sicurezza AI aggiunto nella pagina client AI con traduzioni i18n (IT/EN/FR)

## V3.1.02-0314 — 14 Marzo 2026
- Icona Dashboard Cliente in alto a destra di ogni card nella lista clienti

## V3.1.01-0314 — 14 Marzo 2026
- Fix route PHP dashboard cliente: parametro `:clienteId` al posto di regex `(\d+)` incompatibile con il router

## V3.1.00-0314 — 14 Marzo 2026
- Nuovo schema versione a 3 segmenti: `V{X}.{Y}.{ZZ}-MMGG` (major.minor.patch-data)
- CLAUDE.md riscritto: checklist commit obbligatoria a 8 passi con checkbox
- Domanda "Versione maggiore o minore?" obbligatoria prima di ogni commit
- Messaggio finale commit con menzione esplicita README e VERSIONI
- Regole anti-dimenticanza per README.md e VERSIONI.md

## V3.0-0314 — 14 Marzo 2026
- Dashboard Cliente: nuova pagina `/admin/clients/:id/dashboard` con statistiche dedicate per cliente
- Grafici a torta: ticket (aperti/chiusi), email (assegnate/non assegnate), progetti (attivi/chiusi/bloccati/senza attivita)
- Valori: tempo medio gestione ticket, tempo medio durata attivita di progetto
- Banner cliente con nome azienda, email, telefono, referente (stile Gantt)
- Rinominato "Dashboard Sistemi" in "Dashboard Cliente" nella pagina dettaglio cliente
- AI Assistente admin/tecnico: nuova pagina `/admin/ai` con chat AI general-purpose
- Pannello informativo su fonti dati AI: Repository documenti, FAQ Suprema, Knowledge Base clienti (incluse note salvate con flag KB)
- Link "AI Assistente" nel sidebar admin, visibile ad admin e tecnici
- Nuovo endpoint `POST /api/ai/admin-assist` (Node.js + PHP) con accesso cross-client a tutte le KB
- Nuovo endpoint `GET /api/dashboard/client/:clienteId` (Node.js + PHP) per statistiche cliente

## V2.9-0314 — 14 Marzo 2026
- RAG prompt injection defense: funzione `sanitizeContext()` filtra 20+ pattern di injection dal contesto prima dell'invio al modello AI
- Pattern filtrati: manipolazione istruzioni, cambio ruolo, data exfiltration, meta-prompt
- Difesa su due livelli: sanitizzazione pre-invio (livello 2) + system prompt hardening (livello 1, V2.7)
- Applicata su tutti e 4 gli endpoint AI (Node.js + PHP)

## V2.8-0314 — 14 Marzo 2026
- README: documentazione completa audit IDOR endpoint client vs admin
- Tabella copertura validazione su tutti i 10 endpoint client con dettaglio check per ciascuno
- Sezione anti-prompt-injection AI documentata nel README
- Sezione isolamento tecnico (ownership check) documentata

## V2.7-0314 — 14 Marzo 2026
- Anti-prompt-injection nei system prompt AI: documenti di contesto trattati come dati puri, mai come istruzioni
- Protezione su tutti e 4 gli endpoint AI (ticket-assist + client-assist, Node.js + PHP)
- Blocco esplicito di pattern injection: "ignora istruzioni precedenti", "rivela lo schema", "cambia ruolo"
- AI non rivela mai configurazione interna, schema DB, credenziali o architettura

## V2.6-0314 — 14 Marzo 2026
- Security headers globali nel .htaccess root: CSP, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- Headers applicati su 3 livelli: .htaccess root (HTML), PHP router (API), Node.js middleware (dev)
- Aggiunto Permissions-Policy: disabilita camera, microfono, geolocalizzazione, pagamenti
- README: sezione .htaccess completa con tabella copertura headers, dettaglio protezioni per livello

## V2.5-0314 — 14 Marzo 2026
- Flag "Salva in Knowledge Base" nelle note interne ticket e note attività
- Nota salvata anche in schede_cliente per il cliente associato, disponibile per AI (admin + client)
- Security headers globali (Node.js + PHP): CSP, X-Frame-Options DENY, X-XSS-Protection, Referrer-Policy, X-Content-Type-Options
- README: corrette istruzioni seed (flag file + SEED_KEY dedicata)

## V2.4-0314 — 14 Marzo 2026
- Client AI chat: aggiunto caricamento schede Knowledge Base filtrate per cliente (tenant isolation)
- Ogni cliente vede solo le proprie schede KB nella chat AI, non quelle di altri clienti
- Modifica applicata su entrambi i backend (Node.js + PHP)

## V2.3-0314 — 14 Marzo 2026
- CLAUDE.md: procedura commit aggiornata — push e deploy frontend sono ora obbligatori ad ogni commit
- Aggiunto passo esplicito `git push && git push --tags` e nota IMPORTANTE sulla completezza della procedura

## V2.2-0314 — 14 Marzo 2026
- README.md aggiornato alla V2.1: versione, struttura progetto, schema DB 21+ tabelle, sezione sicurezza completa, istruzioni migrazione con flag file + MIGRATE_KEY
- CLAUDE.md aggiornato: nota migrazioni PHP con flag file e chiave dedicata
- Nuovi file documentati: RateLimiter.php, rateLimiter.js, uploadSecurity.js
- Sezione sicurezza README riscritta: autenticazione, impersonation, rate limiting, upload security, IDOR/BOLA, IMAP hardening

## V2.1-0314 — 14 Marzo 2026
- Security hardening completo su tutti gli endpoint
- Fix XSS: rimosso dangerouslySetInnerHTML da ClientLayout, split chatDisclaimer in 3 chiavi i18n (IT/EN/FR)
- Fix HTTP header injection nei download file (repository + progetti)
- Impersonation blindata: audit log DB, claim admin_id nel JWT, TTL ridotto a 1h, banner amber con uscita rapida
- Upload security: magic bytes validation, blocco doppie estensioni, whitelist globale, .htaccess anti-esecuzione in uploads/
- IMAP hardening: rate limit 30 email/ciclo + 10/ora per mittente, body troncato a 50KB, stripHtml rinforzata
- Anti-spoofing: [TICKET] verifica mittente vs cliente del ticket, [COMM] accettato solo da admin
- IDOR/BOLA fix: tecnico limitato a ticket/progetti assegnati, KB cards solo admin, referenti solo admin
- Rate limiting login: express-rate-limit globale (100/min), lockout progressivo 5 tentativi/15min (Node.js + PHP)
- Rate limiting AI: 20 req/min, impersonation: 5/ora
- PHP RateLimiter DB-based per Aruba (no Redis)
- Tabelle DB: audit_log + rate_limits
- Endpoint GET /api/users/audit-log per consultare log operazioni sensibili
- Migrazione/seed: chiavi dedicate sha256, flag file _ENABLE_, reset solo CLI, logging

## V2.0-0314 — 14 Marzo 2026
- Stato progetto calcolato automaticamente: Chiuso (tutte attività completate), Attivo, Bloccato (attività bloccata), Senza attività
- Eliminazione progetto con conferma (cestino in ProjectDetail e ProjectGantt)
- Colonna 2F nella tabella utenti portale (admin e client) con SI/NO
- Checkbox "Cambio password al primo avvio" disabilitato dopo primo cambio, riabilitato solo se admin cambia password
- Timeline: filtri Aperti/Chiusi/Senza Attività/Tutti, legenda pallini colorati
- Colori timeline aggiornati: blu=attivo, verde=chiuso, rosso=bloccato, grigio=senza attività
- Fix cache CDN Aruba: index.html rinominato in _app.html, servito via index.php con header no-cache

## V1.8-0313 — 13 Marzo 2026
- Cambio password al primo avvio: modale con nuova password + conferma + toggle visibilità
- Autenticazione a 2 fattori via email: codice 6 cifre via noreply, 3 tentativi max, scadenza 10 min
- Opzioni sicurezza (cambio psw + 2FA) nel form utenti admin e client
- Versione app nel sidebar admin
- Nota sotto email referente commerciale in creazione/modifica cliente
- Nuove colonne DB: cambio_password, two_factor, two_factor_code, two_factor_expires, two_factor_attempts
- Traduzioni i18n IT/EN/FR per 2FA e cambio password

## V1.7-0313 — 13 Marzo 2026
- Aggiunto script `npm run reset` per reset DB finale (solo utente admin)
- Aggiornate regole Git in CLAUDE.md con procedura versioning dettagliata

## V1.6-0313 — 13 Marzo 2026
- Disabilitato caching browser per index.html e risposte API (meta tag + .htaccess)

## V1.5-0313 — 13 Marzo 2026
- Dettaglio progetto client: aggiunta descrizione breve, allegati, referenti
- Vista compatta client: righe espandibili con toggle descrizione/allegati/referenti
- Admin ProjectDetail e ProjectGantt: aggiunto toggle referenti e label STM Manutenzione Ordinaria
- Layout client allargato a max-w-6xl
- README.md riscritto, CLAUDE.md snellito, rimosso PROJECT_CONTEXT.md obsoleto

## V1.4-0310 — 10 Marzo 2026
- Pagina admin comunicazioni (`/admin/comunicazioni`) con CRUD completo
- Banner comunicazioni ridisegnato con tracking lettura per utente
- Contatore letture lato admin (letti/totale utenti)
- Flag "importante" per comunicazioni persistenti

## V1.3-0310 — 10 Marzo 2026
- Referenti progetto (tabelle `referenti_progetto` + `progetto_referenti`)
- Fix login e validazione token
- CronRunner PHP per job automatici
- Fix migrazioni PHP per MySQL 5.6

## V1.1-0310 — 10 Marzo 2026
- Config criptato (`config.env`) per credenziali server
- Polling automatico email IMAP
- Notifiche admin per nuovi ticket
- Footer con versione app nella Dashboard

## V1.0-1003 — 10 Marzo 2026
- Fix deployment Aruba: compatibilita MySQL 5.6, CGI auth header, base path
- Primo deploy funzionante in produzione

## V0.9 — 9 Marzo 2026
- Porting completo backend PHP/MySQL per hosting Aruba
- Router custom PHP, PDO MySQL, PHPMailer
- Toggle visibilita AI per cliente
- Miglioramenti email noreply
- Background personalizzato pagina login

## V0.8 — 7 Marzo 2026
- Sistema allegati progetto (upload, download, delete)
- CLAUDE.md per continuita sessioni Claude Code

## V0.7 — 7 Marzo 2026
- Hardening sicurezza login (verifica token su DB al mount)
- Chat AI client con Groq Llama 3.3 70B
- Banner comunicazioni cliente nel portale
- Campo descrizione progetto

## V0.6 — 7 Marzo 2026
- i18n portale client (IT/EN/FR)
- Chat AI client con integrazione Groq
- FAQ scraper per knowledge base AI
- Tag email `[COMM slug]` per comunicazioni cliente via IMAP

## V0.5 — 4 Marzo 2026
- SLA per cliente (1g, 3g, nb)
- Email noreply dedicata
- Fix IMAP polling
- Gestione utenti portale client (admin portale)

## V0.1 — 2 Marzo 2026
- Commit iniziale: MVP completo
- Admin panel + Client portal
- Ticket, Progetti, Attivita, Email, Clienti, Utenti
- Dashboard con statistiche
- Chat progetto admin/tecnico
