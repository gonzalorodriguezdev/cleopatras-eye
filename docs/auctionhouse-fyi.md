# AuctionHouse.fyi integration

Cleopatra’s Eye reads the public API automatically. The default market is **Americas / PvP / Alliance** (`forever.pvp.alliance.us`). No account or API key is required. Settings → Data sources controls enablement, interval (15–1440 minutes), manual sync, connection status, timestamps, counters and recent errors.

## Source policy

- Local imported scans are the primary truth for each item, even when older. Stale local prices remain visibly stale and cannot silently become fresh through the API. The latest local observation survives the 200-scan history window.
- Community prices fill items without local observations. Their histories remain separate; they never rewrite local scans. API failure, disabling or access loss preserves prior data and leaves the independent Auctionator capture running.
- Auctionator raw files are decoded for archive inspection. The installed Cleopatra’s Eye Bridge records timestamped summaries and completed listing scans for independent automatic import. The first official in-game scan remains unvalidated. See [local integration](auctionator.md).
- Community summaries are minimum asking prices plus aggregate quantities, potentially including bid-only auctions. They cannot supply listing percentiles, order-book depth, executable purchase quantities or completed-sale evidence. Unknown quantity remains null; a null price suppresses an older price rather than reviving it.
- Exact variant keys are preserved up to JavaScript’s safe-integer limit. API keys are stored as strings; local IDs use exact safe integers in PostgreSQL double precision. No suffix/base-ID collapsing.
- Price dates come from each row, not the snapshot publication/import time. Publication and import are stored separately. Observations before **2026-11-04 23:00 UTC** are retained as `prelaunch` and excluded from live reports. This boundary comes from Blizzard’s global launch announcement. The API does not label every observation’s game phase; classification uses the exact market and original timestamp. Future timestamps and incorrect markets fail validation.

## Runtime and persistence

The backend starts a nonblocking scheduler on boot and checks due work every 30 seconds. It requests `/api/v1/ah/forever.pvp.alliance.us/snapshot`, with ETag revalidation when available. The public snapshot is published hourly; 15-minute polling does not create 15-minute market observations.

PostgreSQL stores source settings/state, immutable raw snapshots and price points. Stable observation hashes exclude publication time. Unchanged hourly rows are not inserted again. An atomic database lease prevents two backend processes from syncing concurrently. Insert batches run in one transaction: an invalid or failed import cannot leave a partial price snapshot. Retry state survives restarts.

429 and transport/server failures back off with jitter and honor Retry-After. 401/403 stop automatic retries until settings are saved after the access problem is addressed. Manual sync honors backoff and a one-minute minimum request gap. Disabled sources retain history. Requests have timeouts and bounded response sizes. Logs contain source/market/counts, never credentials. Recent sanitized errors are available in Settings.

The item search index supplies names, refreshed at most daily per backend process; numeric icon identifiers are supported. A metadata outage retains exact item IDs and does not block prices. Later metadata reads fill unknown names.

Existing report calculations serve dashboard, history, flipping, crafting, disenchanting, farming, watchlist and in-app alerts. The open window refreshes every 30 seconds without overwriting unsaved risk settings. Alerts have stable scan/price identities and are not appended repeatedly. Background data ingestion continues with the window closed; opportunities/alerts are derived on the next report read. Gold, inventory, mobile access and external notifications remain outside the requested scope.

Report limits: latest 200 local scans plus last local item anchors; latest 200,000 community points, capped at 200 observations per item. Older records remain in PostgreSQL. No synthetic data is inserted into the user's database by source integration tests.

## Environment and updating

Run `npm ci`, `npm run db:migrate`, `npm run db:generate`, `npm run build`, then restart the backend using the supplied startup script. Existing automatic Windows startup invokes the same backend, so it also starts this scheduler.

Optional initial defaults:

```dotenv
AHF_ENABLED=true
AHF_INTERVAL_MINUTES=15
AHF_LIVE_SINCE=2026-11-04T23:00:00.000Z
```

Enabled/interval are persisted after initialization; change them in Settings. The launch cutoff is a deployment boundary, not a switch for treating test data as live. Changing it does not reclassify previously stored history. The service intentionally uses the fixed official API origin and a fixed market rather than accepting arbitrary download URLs.

## Contribution and MCP (researched, not installed)

The official Windows companion and its supported addon can contribute real order books. Download only from the official download page, install the companion/addon, pair the companion with your account, select the correct market and perform a complete scan in game. The companion reads the addon's visual output. Contribution access is governed by the service; verify granted features through `/api/v1/me`. Accepted credited scans can grant a rolling seven-day contributor window, including additional current-price/history/book features depending on the account.

This integration uses the public hourly feed. It does not automatically upgrade to gated live endpoints when an account contributes. No account has been paired, no companion installed, and no scan uploaded by this change. Auctionator minimum-price summaries cannot reconstruct valid order books and must not be uploaded as invented auctions.

An MCP endpoint is documented at `https://auctionhouse.fyi/mcp`, with public reads and OAuth for account features. MCP is optional and does not upload scans; this app uses the documented HTTP API directly.

## Verification

- Unit: `npm test` covers validation, market scope, safe variant IDs, null values, timestamps, prelaunch separation, row deduplication, local precedence, stale evidence, depth restrictions and retry timing.
- PostgreSQL integration: `npm run test:sources` creates a uniquely named temporary database, applies all migrations, uses labeled synthetic transport data, tests automatic startup, shared lease, reports/flipping/DE, dedup, absence, prelaunch, malformed/429/403 responses and disabling, and drops only that database on completion. Requires a local test connection with CREATE DATABASE permission. It never uploads data.
- Existing app integration: `npm run test:integration`.
- Real connection checked on November 2 Argentina / November 3 UTC: snapshot returned **6,435** rows for the correct market. Newest original observation was **October 11, 2026, 15:45:52 UTC**. All were stored as prelaunch; none appeared as live opportunities. No live-launch prices or contributor-only features were validated.

## References (reviewed November 2, 2026)

- [API overview](https://auctionhouse.fyi/docs/api)
- [Protocol contract](https://auctionhouse.fyi/developers/reference/protocol/api-v1.md)
- [Data model](https://auctionhouse.fyi/docs/api/data-model)
- [Market keys](https://auctionhouse.fyi/docs/api/markets)
- [Authentication](https://auctionhouse.fyi/docs/api/authentication)
- [Errors and limits](https://auctionhouse.fyi/docs/api/errors)
- [Official companion download](https://auctionhouse.fyi/download)
- [MCP and agents](https://auctionhouse.fyi/docs/api/agents)
- [Blizzard global launch time](https://news.blizzard.com/en-us/article/24315820/world-of-warcraft-forever-goes-live-globally-november-4)
