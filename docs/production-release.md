# ExpenseFlow — verifica e rilascio del 28 ottobre 2026

## Diagnosi verificata

- Branch di lavoro: `feature/fix_frontend`, commit di partenza `30ae666` prima dei quattro commit di preparazione del rilascio.
- GitHub verificato con `git ls-remote`: feature `30ae666b9730557075a3e39f82e7a745889821e0`, develop `afade7dffc30cf6416b96c0d2eed92b3c379bdd4`, main `d330a280c6a519ea08a6cec50ad0a71df499f593`.
- Gli alberi dei tre branch sono identici prima di queste correzioni; main include già la 011 e il supporto connessione locale. L'utente ha confermato nel pannello Render: servizio `expenseflow`, repository `AntoM-2025/expenseflow`, branch `main`, commit Live `d330a28`, precedente `8a4a05f`, Auto-Deploy attivo.
- `App.tsx` attendeva tutte le risposte con `Promise.all`, verificava tutti gli status e solo dopo aggiornava i tre stati. Un 500 di incomes impediva di mostrare expenses/payers già ricevuti. Il flag di errore condiviso nascondeva anche tabelle e riepiloghi.
- Adesso caricamenti, errori e stati sono separati. Le righe API includono il nome del pagatore: vengono utilizzate come fallback per mostrare le transazioni anche quando `/api/payers` fallisce. Totali indipendenti; saldo e grafico restano indisponibili con dati incompleti. Gli errori indicano la sezione e, per 401, la necessità di autenticarsi nuovamente. Un reload riprova i caricamenti.
- Express registra GET expenses e i router payers/incomes, protetti da sessione PostgreSQL. Le query filtrano per utente e verificano la proprietà del pagatore. Il controllo Origin lascia passare GET; il fallback React esclude `/api`.
- Produzione pubblica: `/api/health` 200, `/api/expenses` e `/api/incomes` 401 senza cookie. Il precedente 404 non è riproducibile. Non attribuirlo a un commit vecchio senza la cronologia Render.
- Neon, connessione del file locale `.env.neon`, database `expenseflow`: 1 utente, 2 pagatori, **57 spese**, tutte incluse nel join usato dall'API; `public.incomes` assente. Migrazioni 001–010 con checksum corretti, solo 011 pendente. Audit eseguito in transazione READ ONLY.
- `expenseflow_debug` su 127.0.0.1:5433: 1/2/57, incomes presente con zero righe, tutte le 11 migrazioni coincidono.
- Attenzione: `.env` seleziona normalmente `expenseflow`, NON debug. Quel database locale ha 3 utenti, 6 pagatori, 4 spese, incomes presente e manca `schema_migrations`. Non eseguirvi il runner e non inventare una baseline.
- Docker mancava di `/app/database/migrations`: aggiunta la copia dei file SQL nell'immagine finale. Nessuna migrazione automatica in CMD o startup. Nessun file SQL modificato.

## Test e limiti

Superati:

- Server: `npm run typecheck`, `npm run build`.
- Client: `npm run build`, `npm run lint`.
- `node --test client/tests/*.test.mjs`: 13 test, inclusi 401/404/500 per ogni sezione, richiesta lenta, JSON non valido, errore di rete, annullamento e aggregazioni mensili.
- `server/tests/movements.integration.mjs` con Node 24: migrazioni, registrazione/login/sessione, CRUD, validazione, isolamento di payers/expenses/incomes fra due utenti, 401 e 404. Usa solo record sintetici in un nuovo database locale. Ora rifiuta host remoti e conserva il database invece di eseguire DROP.
- Database di test conservato: `expenseflow_test_a74e76d368a3`.
- `docker build -t expenseflow:release-candidate .`: riuscita.
- Smoke test della stessa immagine, runtime production e connessione solo a debug: health 200, quattro endpoint autenticati 401 senza sessione, API inesistente 404, pagina iniziale e fallback SPA 200, presenza SQL 011.
- `git diff --check`.

Non eseguiti: login con credenziali reali di produzione, controllo visivo nel browser e lettura autenticata delle 57 righe via HTTP. I conteggi 57/2 sono verificati direttamente in SQL, incluso il join dell'API; i test di autenticazione usano account sintetici. Nessun lint backend configurato.

Ripetere lo smoke test locale (Docker Desktop, credenziali locali in `.env`):

```bash
docker run --rm -i --env-file .env -e POSTGRES_DB=expenseflow_debug \
  expenseflow:release-candidate node --input-type=module < scripts/docker-smoke.mjs
```

## Backup verificato

File esterno alla repository: `~/ExpenseFlowBackups/expenseflow-prod-2026-10-28.dump` (16117 byte).
SHA-256: `4774a80837fe9350a491a2cf269c3a130171b7346dc053342b1b39bab7b288c7`.
Formato custom PostgreSQL 18.6. Indice leggibile e decodifica integrale riuscita.
Ripristino di prova completato **in un nuovo database locale** `expenseflow_backup_verify_20261028_01`, con `--exit-on-error --no-owner --no-privileges`, senza clean/drop.
Audit dopo il restore: 1 utente, 2 pagatori, 57 spese; checksum 001–010 corretti; 011 assente come nella sorgente. Nessun dato di user_sessions nel dump: un recupero richiede nuovo login.
Successivamente il runner compilato della release candidata è stato eseguito solo su questa copia locale: SKIP 001–010, OK 011. Audit dopo la migrazione: sempre 1 utente, 2 pagatori, 57 spese, incomes vuota e tutti gli 11 checksum corretti.
Il backup è verificato per questo snapshot; non include eventuali modifiche successive. Prima della migrazione acquisire un nuovo backup verificato, mantenendo anche questo.

## Gate prima di modificare produzione

Lo Step 1 autorizza quattro commit locali sul branch `feature/fix_frontend`. Push, merge, deploy e migrazioni Neon richiedono un'approvazione successiva.
`COMMIT_MESSAGE.txt` contiene il riepilogo richiesto dall'utente ed è escluso dai commit.
Non c'è accesso autenticato Render disponibile in questa sessione. Branch e commit dei deployment sono stati confermati dall'utente; completare nel pannello Render le verifiche residue:

1. **Settings**: repository e branch `main` confermati, Auto-Deploy attivo. Verificare runtime Docker, root del repository, Dockerfile `./Dockerfile`, Docker command senza override inattesi, eventuale pre-deploy command senza migrazioni automatiche e health check.
2. **Deploys**: Live `d330a28`, precedente `8a4a05f` confermati dall'utente. Registrare anche gli ID dei deployment e consultare i log del deploy che presentava il 404. Prima del prossimo rilascio il riferimento di rollback applicativo è il Live attuale `d330a28`; `8a4a05f` differisce solo nel runner delle migrazioni e non corregge il difetto frontend.
3. Environment: verificare privatamente che DATABASE_URL corrisponda a Neon `expenseflow-beta` / branch `production` / database `expenseflow`, role `expenseflow_owner`; confermare il collegamento nel pannello Neon. L'audit SQL non identifica il nome commerciale del progetto/branch Neon.
4. Verificare APP_ORIGINS o RENDER_EXTERNAL_URL con l'origine HTTPS pubblica; nessun valore segreto va inviato in chat.
5. Registrare i risultati nel ticket di rilascio. Servono branch, SHA e ID deploy, non token o password.

Riferimenti ufficiali: [deploy e branch Render](https://render.com/docs/deploys), [limiti Free](https://render.com/docs/free), [rollback Render](https://render.com/docs/rollbacks).

## Sequenza di rilascio — solo dopo approvazione esplicita

1. Riesaminare il diff e i test. Commit locali autorizzati per lo Step 1:
   - `fix(client): isolate dashboard section loading failures`
   - `fix(docker): include database migrations in runtime image`
   - `test(server): strengthen movements integration tests`
   - `docs(release): add production safety and deployment procedures`
   Selezionare esplicitamente i file; non usare `git add .` includendo il file messaggio preesistente. Escludere `.env*`, dump, node_modules e build.
2. **Con approvazione per push/merge**, pubblicare `feature/fix_frontend`, PR verso `develop`, verificare check, PR `develop` → `main`. Prima di merge/push controllare Auto-Deploy: main può attivare immediatamente produzione. Eventuale disabilitazione di Auto-Deploy richiede anch'essa approvazione. Non occorre resettare o riscrivere la storia dei branch.
3. Prima di eseguire SQL: verificare il target in sola lettura nello stesso ambiente/shell che userà il runner:

   ```bash
   node --env-file=.env.neon scripts/audit-database.mjs
   ```

   Confermare host Neon atteso, database expenseflow, 57 spese (o eventuali nuovi dati legittimi documentati), 2 pagatori, 1 utente, checksum 001–010 corretti, **solo 011 pendente**. Le variabili già esportate prevalgono sul file: non proseguire se il target non coincide. Fermarsi per checksum divergenti, migrazioni sconosciute, schema inatteso o conteggi diminuiti.
4. Acquisire e validare un backup fresco PostgreSQL 18, formato custom, escludendo solo i dati di user_sessions. Scegliere un nuovo nome di file, mai sovrascrivere il backup verificato. Credenziali via ambiente/file protetto, non nella riga di comando o nei log. Ripristino di prova solo su nuovo database separato.
5. **Chiedere approvazione separata per la migrazione**. Modifica: creare incomes, vincoli e indice, registrare checksum 011. Non aggiorna o elimina spese/pagatori/utenti. Rischi: breve acquisizione lock sui riferimenti, errore di connessione/permessi, target sbagliato. Eseguire una sola istanza del runner, senza attività concorrenti di migrazione.
6. Dal checkout verificato, dopo build backend e approvazione, dalla root:

   ```bash
   NODE_ENV=production node --env-file=.env.neon server/dist/migrate.js
   ```

   Atteso: SKIP 001–010, OK 011. Il runner racchiude SQL e registrazione checksum nella stessa transazione. Con esito di rete ambiguo rieseguire prima l'audit; non lanciare SQL manuale né modificare checksum. Non aggiungere migrazioni allo startup del servizio.
7. Ripetere audit: 011 MATCH, incomes 0, conteggi esistenti invariati. Se fallisce, fermare il rilascio. Una seconda esecuzione autorizzata del runner deve saltare tutte le migrazioni.
8. **Solo con approvazione del deployment**, completare merge main/deploy secondo il flusso concordato. Controllare SHA effettivo in Deploys, log di build e startup, nessun errore missing relation. Non basarsi soltanto su health: fa SELECT 1, non verifica lo schema.
9. Verifica pubblica: health 200; senza cookie auth/me, expenses, incomes, payers 401; con login dell'utente esistente tutte e quattro 200, expenses 57, payers 2, incomes array. Browser: transazioni, totali, grafico, cambio sezione, refresh e sessione persistente. Non inserire/eliminare dati reali per test. Per verificare il degrado frontend bloccare `/api/incomes` in DevTools e ricaricare: spese e pagatori restano visibili, errore entrate, saldo indisponibile. Ripristinare il filtro dopo la prova.

## Rollback

- Fallimento della 011 prima del commit: transazione annullata, verificare con audit. Se il commit è riuscito, **lasciare incomes e la riga schema_migrations**: sono additive e compatibili con il codice precedente. Nessuna down migration o DROP.
- Regressione applicativa: previa approvazione, selezionare in Render il precedente deploy verificato, Deploys → Rollback. Il rollback dal pannello disabilita Auto-Deploy; controllarne lo stato prima di riabilitarlo. Render Free limita i deploy precedenti disponibili: annotare l'ID prima di iniziare. Se l'artefatto non è più disponibile, valutare un deploy manuale dello SHA verificato, sempre con approvazione.
- Il rollback applicativo non ripristina Neon. Verificare anche le variabili d'ambiente associate al deploy precedente; non ripristinare una vecchia connessione per errore. Ripetere health/login/conteggi dopo rollback.
- Un rollback a una versione contenente lo stesso caricamento aggregato non risolve da solo la mancanza di incomes: mantenere la 011 applicata. Eventuali entrate create nel frattempo restano nel database anche se il frontend precedente non le mostra.
- Solo in caso di corruzione reale, con ulteriore autorizzazione: sospendere scritture, preservare lo stato corrente, ripristinare il backup in **un nuovo database/branch**, verificare conteggi, sequenze, vincoli e account, valutare le scritture successive al backup, poi approvare un eventuale cambio connessione. Mai restore sopra produzione. Nessun DROP/TRUNCATE/DELETE di dati reali.
