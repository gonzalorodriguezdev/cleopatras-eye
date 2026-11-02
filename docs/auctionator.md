# Auctionator 341 integration findings — 2026-11-02

Inspected installed source (not validated in-game): Source_LegacyAH/Tabs/Auctionator/Mixins/ScanButton.lua initiates full scan on click. FullScan/Mixins/Frame.lua checks CanSendAuctionQuery and emits ScanComplete only after database processing. A timestamp at scan initiation is not proof of completion.

Source/Database/Mixin.lua stores m (last observed minimum), l (daily lowest low), h (daily highest low), a (highest quantity observed that day). These are not individual listings, completed sales, current supply or full price distributions. Source/Variables/Main.lua stores database version 8 and serialized CBOR realm data. The inspected local PvP/PvE payloads contain version metadata only, not usable auction prices. Vendor cache values are not auction prices.

Implemented evidence capture: poll the configured AUCTIONATOR_FILE every five seconds; require two identical content hashes and unchanged metadata during reading; preserve exact bytes and provenance under ignored data/raw/auctionator. Never execute Lua. SHA-256 names deduplicate snapshots. Archive all captures as unclassified/unverified, including old files. File write time is not a scan timestamp. GET /api/capture reports capture status. This captures file versions, not necessarily individual completed scans; multiple in-memory scans before a save cannot be reconstructed.

Pending: bounded Lua string decoding and CBOR parsing, aggregated-price schema, verified realm/faction/region/phase association, fixture from a completed Forever scan and in-game validation. Price normalization/import is NOT enabled. Raw archives may contain user configuration; keep local.

In-game procedure: open AH, manually request Auctionator full scan when available, wait for finished processing, then /reload or logout to flush SavedVariables. No new addon installed and existing addons were not modified. Exact button location/availability must be checked in Forever UI. A scan from beta must stay beta.
