# Learning with Forever Auction Intelligence

This is a real project under development, not a reference implementation of every best practice. Read README.md for known limitations and verification status. Never use synthetic examples as live game evidence.

## Suggested reading order

1. **Product and boundaries:** README.md, SPEC-original.md and docs/auctionator.md. Compare the original request with the final decisions recorded in README.
2. **TypeScript and validation:** shared/contracts.ts and server/domain.ts. Follow a transaction from an input object through Zod validation.
3. **Business calculations:** shared/analytics.ts and tests/analytics.test.ts. Start with weighted-average cost and realized profit, then study price references, depth and uncertainty.
4. **Database:** prisma/schema.prisma and prisma/migrations/. Trace how an edit creates a new audit revision and why transactions roll back invalid sales.
5. **Backend:** server/index.ts and server/workspace.ts. Follow a request from route to validation, database transaction and response.
6. **Frontend:** src/main.tsx, src/forms.tsx and src/style.css. Explore React state, forms, API calls and error handling.
7. **Desktop:** desktop/main.cjs and scripts/start-background.ps1. Understand the separation between the desktop window, local API and database.
8. **Integrations:** server/capture.ts and server/ai.ts. Study binary-safe capture, deduplication, credential handling and explicit consent.
9. **Verification:** tests/, scripts/verify-workspace.ts and .github/workflows/ci.yml. Distinguish unit tests, integration tests and live game validation.

## Small exercises

- Add a failing test for a transaction fee, then fix the calculation if needed.
- Add a portfolio filter without changing the stored records.
- Explain why an observed auction price is not a completed sale.
- Trace a record edit and its earlier revision in the database.
- Add a new report field and update its validation and UI together.

Use a separate branch for exercises. Do not experiment on your live trading database; use an isolated database and synthetic fixtures.

## Git workflow

Commit one coherent change at a time. Describe what changed and why; include relevant test results in a pull request. Review diffs before pushing. Future development can be uploaded as explicit checkpoints in this chat; there is no autonomous watcher that publishes local files.

Never commit `.env`, credentials, game SavedVariables, raw captures, database backups, logs, dependency folders or the local desktop runtime. `.gitignore` excludes these paths. Git history retains committed content even if a later change deletes it, so review before every commit.
