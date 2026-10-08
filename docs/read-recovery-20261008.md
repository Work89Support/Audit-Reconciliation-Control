# Read recovery follow-up · 2026-10-08

Observed in production: FR8 2026-10-06 overview timed out at 30 seconds. Independent Supabase SQL Editor catalog diagnostics also returned connection timeout twice; an initial activity check found zero waiting locks and a later SELECT 1 succeeded. These observations do not establish a single server-side root cause.

The frontend now coalesces identical concurrent JSON GET requests within one identity/project and invalidates them at writes/sign-out. It retains no completed financial-result cache, never coalesces uploads/approvals/writes, and permits retry after a failed request. Entering the company worksheet no longer also starts thirty days of all-company background aggregates and match evidence. Other routes retain their overview loaders and unknown counts remain unknown. Manual refresh failure no longer claims that a save occurred, nor that the case count is zero. Browser asset versions are refreshed.

Tests cover concurrent reads, failures/retry, write invalidation, sign-out isolation, existing authentication and upload recovery. No customer cases were closed or modified to test this patch. Frontend request reduction alone cannot guarantee recovery from an unavailable database.
