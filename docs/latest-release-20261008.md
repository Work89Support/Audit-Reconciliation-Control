# Latest workflows release · 2026-10-08

Scope: cross-day BO/STM review and attachment receipt recovery only. Built on origin/main (PR 28) to retain published authentication, file snapshots, navigation and UI fixes.

Validation: full npm test passed; attachment-resume and cross-day-workbench tests passed; UI QA and approval navigation regressions passed; syntax and diff checks passed. Browser fixtures used synthetic data, not customer transactions.

Production database: cross-day schema and unauthenticated RPC rejection were tested inside a transaction and rolled back. This exposed and fixed PL/pgSQL CASE syntax before installation. The migration then returned Success. No rows returned. Existing attachment indexes were already valid and were not recreated. Actual customer request submission/approval has not been tested.

Limitations: selectable native STM rows currently require verified SCB cache/hash. Unsupported/unreadable BBL remains preview-only. Pending drafts/uploads are tab-local. A completed latest reconciliation run is required for submission and approval; reruns invalidate old source snapshots. Database connection timeout cannot be guaranteed resolved by client recovery alone.

Old managed worktrees were archived with recoverable snapshots. Plain worktrees 0319 and manual-pairing-20261004 were backed up under the primary workspace tmp/worktree-archive-20261008 before removal; the primary workspace and this latest release worktree were retained.
