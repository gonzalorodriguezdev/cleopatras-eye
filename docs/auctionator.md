# Auctionator local integration — 2026-11-02

## Everyday use

1. Restart the WoW client once after installing the new addon so it discovers **Cleopatra's Eye Bridge**. Leave it and **Auctionator** enabled.
2. Open the auction house and manually run Auctionator's full scan. Wait for completion.
3. Type `/reload` or log out to save the observations.
4. Cleopatra's Eye waits for two stable reads (normally about 5–10 seconds), archives the original bytes and imports new observations into PostgreSQL. The open dashboard refreshes every 30 seconds. There is no manual export or import step.

The bridge is installed in the existing `_forever_/Interface/AddOns/CleopatrasEyeBridge` directory. Source is in `addon/CleopatrasEyeBridge`. Reinstall with `scripts/install-bridge.ps1`; existing bridge files are backed up under ignored `data/addon-backups`. Auctionator's files are not modified. Its SavedVariables and the bridge SavedVariables are watched independently. API failures do not stop either watcher.

## What is collected

The passive bridge observes Auctionator 341's `Database:SetPrice` and `FullScan.Events.ScanComplete`, based on the installed addon source. It never initiates auction queries, clicks, purchases, sales or game input.

- **Completed full scan:** the completion event supplies the original `auctionInfo` (legacy AH) or `replicateInfo` (modern AH). The bridge records positive-buyout listings with original stack quantity, original stack buyout and base item ID from the item link. Unit prices are rounded UP to integer copper, conservatively, as the existing normalized listing pipeline requires. Consequently the simulated total may exceed a whole stack's actual buyout by less than one copper per unit. Actual stack purchases must be checked in game.
- **Partial price observations:** the SetPrice hook saves the observed minimum, available quantity when supplied and server recording time. These remain aggregates: no listing percentile, depth or purchase quantity is fabricated.
- **Recent buffering:** the bridge saves the last two completed full scans and the latest partial observation per item. More than two full scans before a save cannot all be recovered. A scan exceeding 100,000 buyout rows is not silently truncated. The original saved file is always archived.
- **Identifiers:** ordinary/base item IDs are supported. Auctionator's `gr:` suffix, `g:` level and `p:` pet keys are not incorrectly converted to community variant IDs. Full listings are grouped by base item ID; equipment variants may differ. Match the actual item in game; variant-specific valuation is not claimed.
- **Market:** the installed bridge only records PvP / Alliance. Americas is the configured deployment scope, per the user's single-market instruction; this bridge is not a cross-region character tracker. The importer verifies realm/faction and excludes prelaunch timestamps from live calculations.

## History and source priority

Local observations always precede community data for the same item, even when stale. Within local evidence, use completed listing history when it is at least as recent as the partial summary; otherwise use the newer summary history. The two representations of one full scan are not counted twice. Older local item anchors survive report-history limits. No absence or completed sale is inferred from an item missing in a scan.

Snapshot fingerprints deduplicate imports across repeated `/reload`, backend restart and multiple workers. A single database transaction imports a saved file's summaries and full listings. Malformed/incomplete data fails without partial inserts. Failed imports retry on later polls; restoring the last good file clears the error. Raw captures contain private local configuration and stay ignored by Git.

## Why the separate bridge is necessary

Auctionator's version-8 price database is stored as Lua tables or CBOR realm payloads, realm format version 2. `m` is its last seen minimum; `l` and `h` are daily low/high minima, and `a` is the highest observed quantity during that day. Its scan-day epoch is local midnight January 1, 2020. These daily records do not contain the exact time, original stacks or reliable current quantities. File modification time is not a scan time.

The new bounded Lua-data and CBOR decoders read the original database safely for archive inspection. Historical daily records are NOT silently reclassified as fresh market prices. The bridge captures the missing timestamp and listing evidence at the time Auctionator produces it. No saved Lua is executed by the app. Unsupported formats fail explicitly.

## Verification and remaining live check

- Existing real `Auctionator.lua` decoded successfully: PvP and PvE realm payloads, zero usable historical items. No test prices were inserted into the user's database.
- Data-parser tests cover raw byte/UTF-8 preservation, nested tables, supported CBOR representations, truncation, excessive depth, unsafe numbers, duplicate keys and executable Lua rejection.
- The actual shipped bridge Lua runs in a development-only Lua VM against mocked game events: passive initialization, no duplicate hook, wrong-faction exclusion, fractional-stack rounding, legacy/modern completion payloads and two-scan retention. The app's importer does NOT use that VM.
- Isolated PostgreSQL integration exercises stable-file detection → importer → source selection → dashboard report, dedup after restart, corrupted-file recovery, full listing import and independent operation with the API disabled.
- **Still requires the first official in-game scan:** actual game loading, Auctionator event payloads and displayed game prices must be checked on the live client. Mocked tests and an empty historical file cannot prove that runtime path. No game scan was performed by the assistant.

Installed source references: `Source/Database/Mixin.lua`, `Source/Variables/Main.lua`, `Source/Constants/Main.lua`, `Source/Utilities/DBKeyFromLink.lua`, `Source_LegacyAH/FullScan/Mixins/Frame.lua`, `Source_ModernAH/FullScan/Mixins/Frame.lua`, and `Source_LegacyAH/Tabs/Auctionator/Mixins/ScanStatus.lua`.

## Live realm alias verified on November 5, 2026

The live client reports `CAMWOW US2 Realm 6 PvP`. The bridge accepts this exact alias and canonical `PvP`, always requiring Alliance. Both are stored under the configured PvP/Alliance market. Other realms are rejected. Reload the UI after updating the bridge, complete a new full scan, and reload again to save the observations. Earlier daily prices are not assigned invented scan timestamps.
