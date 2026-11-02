# Forever Auction Intelligence — local desktop edition

English interface. One shared economy for Americas / PvP / Alliance. No character selectors, mobile access, public hosting, external notifications or in-game automation.

## Everyday use

Open **Forever Auction Intelligence** from the Windows desktop shortcut. Closing its window hides it to the system tray. Double-click the tray icon to reopen it. **Quit desktop app** exits the desktop UI; the local API, file capture and Docker can continue running. The existing Windows Startup shortcut runs scripts/start-background.ps1, which starts the backend and then the desktop app in the tray.

The executable is `.desktop/ForeverAuctionIntelligence.exe`. This is a locally assembled Electron runtime, not a signed standalone installer: it depends on this project folder, Node, installed node_modules, Docker and PostgreSQL. Do not move the folder without rebuilding the local desktop package and updating shortcuts. No automatic updater is installed.

## Implemented modules

- Portfolio: purchases, sales, cash transfers, deposit losses, weighted-average inventory cost, realized profit and conditional asking-price valuations.
- Revisions: record edits and voids preserve an audit trail. Invalid corrections that would create negative inventory roll back atomically.
- Market research: minimums, listing median/P25/P75, interactive price points, history and source/date information.
- Timing: observed asking prices grouped by day/hour in the selected timezone; repeated-date evidence threshold. Separate last-30-day recorded sales analysis.
- Depth: observed supply levels, cumulative quantities, buy-fill cost and slippage simulation. No inferred market-wide sales capacity; indivisible stacks require checking in game.
- Flipping research: prior-scan reference, fee/evidence/staleness gates, unusual-price/supply flags, maximum unit entry and limits constrained by recorded cash and existing item exposure.
- Disenchanting: verified-rule input, skill gate, expected net proceeds, ROI, loss probability and direct-sale comparison; actual outcomes consume inventory and produce materials. Individual trials provide empirical frequencies and marginal Wilson intervals. Batch records are excluded from frequency estimation.
- Professions: editable recipes and input/output quantities, material opportunity costs, extra costs and conditional net margins.
- Farming: session duration, yields, costs and estimated gold/hour; recorded yields enter inventory.
- Raid watchlist: entry/exit prices, budget, quantity, thesis, risks and scenario proceeds; economic calendar.
- In-app alerts: configured price thresholds, watch targets, stale data and unusual observations. Evaluated on refresh; no external sends.
- Reports: JSON, flattened ledger CSV and readable summary. CSV formula-leading values are escaped.
- Direct AI analysis: Responses API request with per-request key/model and explicit report-sharing consent. Key is not saved. Output is bounded and response storage disabled. Requires a valid API key/model and any applicable API billing. Tested with mocked transport only; no live charged request made.
- Import: validated normalized listing JSON with atomic PostgreSQL insertion, source preservation and duplicate rejection. Raw Auctionator file capture is separate from price ingestion.
- Backup: Settings button or scripts/backup.ps1. RestoreCopy restores into a NEW database, never overwrites the active database.

## Data limits — not hidden functionality

No real post-launch auction scan has been tested. Auctionator 341 price decoding is NOT implemented: its local raw file is captured byte-for-byte, but it stores CBOR daily aggregates rather than individual listings. See docs/auctionator.md. The JSON import works with explicitly normalized listing data. No community API has been integrated or authenticated.

No Forever fee schedule, recipe list, disenchant table, raid calendar or item catalogue is preloaded as verified. Enter evidence-backed rules before enabling corresponding calculations. The app validates structure and requires an evidence source; it cannot certify a user-entered claim. Realized sales are user records, not inferred from disappeared listings.

Historical workspace analysis currently loads the latest 200 scans in the exact market. Time patterns are observational, not causal predictions. Prices and estimated returns exclude unknown future relisting/deposit losses unless entered as extra or actual costs. Disenchant cost is allocated equally per output unit. All entry forms use integer copper (10,000 copper = 1 gold). Empty ledgers start at the configured opening balance, not a balance read from WoW.

## Run / build

Node 24 and Docker Desktop are installed locally. PostgreSQL 17 runs on localhost:15432. Credentials and local game-file path are in ignored `.env`; never commit it.

- `npm ci`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run build`
- `npm test`
- `npm run dev` for browser development on localhost:5173
- `node node_modules/electron/install.js` if Electron's runtime download is absent
- `node scripts/package-desktop.cjs` to assemble the local desktop executable
- `powershell -NoProfile -File scripts/start-background.ps1 -BackendOnly` to start local services

Daily address is localhost:4312. Development uses 4311/5173. The API binds only to loopback and rejects unrelated Host/Origin values. The desktop renderer has Node integration off, context isolation and sandbox on, no permission grants, no arbitrary navigation or popup windows.

## Verification — 2026-11-02

24 unit tests passed; strict TypeScript and production frontend build passed. PostgreSQL integration checks verified purchases/sales, accounting, oversell rollback, invalid void rollback, edits, audit revisions, scope checks and CSV export. Desktop smoke check exercised all 12 navigation pages, confirmed database connection and captured a rendered screenshot. Closing to tray was checked programmatically. Backup was restored successfully into an isolated recovery database. Login after a full Windows reboot has not been retested since desktop packaging.

Repeat checks with `npx tsx scripts/verify-workspace.ts` (creates and removes only its own synthetic workspace) and `.desktop/ForeverAuctionIntelligence.exe --smoke-test` when the desktop UI is not already running. Test data is not used as live market evidence.

## Sources and implementation notes

- Installed Auctionator source reviewed in docs/auctionator.md.
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron tray: https://www.electronjs.org/docs/latest/tutorial/tray
- OpenAI text generation / Responses: https://developers.openai.com/api/docs/guides/text
- Docker restart policies: https://docs.docker.com/engine/containers/start-containers-automatically/

The original specification is preserved in SPEC-original.md. Later user decisions override it: English UI, desktop, unified economy, no mobile access and no external notifications.

