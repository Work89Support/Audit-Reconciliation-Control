# Round-based queue draining — published; scheduled verification pending

Prepared 2026-09-05. Cutover published 2026-09-06 after explicit user confirmation.
Parent published FIRST: `Round schedule live 2026-09-06`; n8n confirmed schedule
will trigger executions. Then disabled ONLY old Worker trigger `ทุก 10 นาที` and
published `Round cutover - old timer off 2026-09-06`. Worker header Published,
old trigger Deactivated, child trigger retained. No PDF/credential edits in cutover.
Next scheduled round is 16:30 Asia/Bangkok on Sep6. Still need verify that real
scheduled execution and inspect other active flows before claiming all waste removed.
Do NOT re-enable old timer or recreate parent because older notes below say draft.
Historical partial-deployment notes follow; current cutover state above supersedes them.

## 6 Sep 10:09 Thailand post-cutover check

- Worker Published, `ทุก 10 นาที` still Deactivated.
- Executions list auto-refresh ON, no active executions. Latest 8252 at09:41:05
  (child), previous child8251 at09:40:31, child8250 at09:40:24, old timer8248
  at09:40:00. No09:50 or10:00 Worker executions shown. No manual run this check.
- Continue waiting for16:30 scheduled parent run; do not run empty checks in n8n.

## Live handoff state — 5 Sep, about 22:00 Thailand

- Original Worker exported to `/Users/a/Downloads/Audit - Headless Reconciliation Worker - Hybrid PDF (2).json` (33 nodes).
- Worker SAME ID now has 34 nodes: added `รับงานจากรอบตรวจ`, connected by visible
  drag to `รวมเป็นหนึ่งรอบ`. Set claim node Always Output Data=true; changed
  summary to return `worked`, `job_id`, `finished_at`.
- Export `(4).json` verified exactly those two existing nodes changed, plus one
  added trigger. Existing PDF code/credentials untouched. Published named version
  `Round child entry - preserve PDF 2026-09-05`.
- New parent exists ONCE at workflow ID `90J4tmPms7vr8bvR`, title
  `Audit - Round Dispatcher - Drain Useful Queue`. It is DRAFT, not published.
  Imported from private prepared JSON with existing Supabase credential references.
- Parent live manual execution at 14:48 UTC returned has_work=false and stopped
  WITHOUT calling a child. This verifies the empty-queue path only.
- Child-call node recognizes existing Worker trigger; wait-for-completion=true.
  Clicking Execute step with no input did NOT produce output; do not count this
  as a successful child-call test. Need a genuine queued job or explicit safe
  manual test path, then verify job IDs and return worked=true.
- Parent Settings UI selected v1 and Asia/Bangkok and clicked Save. Re-export or
  reopen to verify persistence. Timeout switch clicks failed; 3-hour timeout is
  NOT verified live. The 500-call code guard exists from import.
- File import APPENDS to canvas. Full Worker import was immediately undone
  BEFORE publishing; verification export confirmed no duplicate chain remained.
  Broad select-all/delete was rejected; do not retry broad deletion. Incremental
  node edits plus file-chooser import of a single trigger worked safely.
- Private prepared files live in `/private/tmp/audit-round-import/`. These are
  transient deployment aids, not public source exports.
- Keep old timer enabled until child/queue-drain tests pass; parent draft cannot
  replace it yet. No amounts/dates/case closures changed.

## Behaviour

### 6 Sep 09:40 Thailand — positive live drain test PASSED

- Attempt to publish Worker with old timer deactivated was REJECTED by safety
  review: parent not published/scheduled yet, could interrupt automation.
  Immediately restored timer to Activate/normal state in draft; live published
  Worker was never changed. No workaround attempted. Need user approval for
  cutover order (publish parent first, then disable old timer) and scheduled
  verification. Both tabs marked handoff. Do not retry rejected publish blindly.

- Current real queue had four jobs. Did NOT create/reset jobs for the test.
- Reopened parent Settings: timeout ON 0h40m0s, Asia/Bangkok persisted.
- Ran existing draft parent once. Success in 1m8.092s; finished
  2026-09-06T02:41:30.069Z, has_work=false, stop message says no Worker repeat.
- Three sequential child calls, each returned worked=true and distinct job_id:
  - AT4 Sep5 edb56b8b-6e54-461e-ae18-c647da0ddbb3, 02:40:30.184Z
  - FR8 Sep5 241cb687-1464-4d35-8e6f-425690a28fe7, 02:41:02.445Z
  - UFABET7M Sep5 80f0cc55-10bf-4c9a-85ad-437c3c4bbf78, 02:41:28.802Z
- Live SELECT after drain: AT4/FR8 needs_review attempts1, UFABET7M completed
  attempts1. SK8 Sep4 6d466bda-ee3d-4a07-8df8-57ff1163cdd4 also needs_review
  attempts1 but was NOT a parent child; likely old timer claimed it. Do not
  attribute that job to this parent. No failed jobs were looped/requeued.
- Need inspect parse/reconciliation details and other active workflows, then
  disable old timer/publish worker and publish parent. Parent still DRAFT and
  old timer still ON at this checkpoint. Do not claim scheduled switch complete.

### 6 Sep 09:07 Thailand follow-up

- Read-only live SELECT of daily_recon_jobs (queued, not archived, attempts < 3)
  returned 0 rows. Did not run dispatcher/worker again or manufacture work.
- In-app browser SQL access works; native GitHub Desktop control lacked Computer
  Use permissions in the preceding user turn. This is not a Supabase login failure.
- No timer/publish changes this follow-up; genuine child/drain test still pending.
- Separate UI wording commit 159e952 is local only; CLI push failed for missing
  GitHub authentication. User already asked to Push origin in GitHub Desktop.

### 6 Sep 08:40 Thailand follow-up

- Mac accessible again. Parent manually ran against the current real queue:
  finished 2026-09-06T01:38:20.639Z, Success in 3.388s, has_work=false, no child
  invoked. Do not repeat empty executions as a substitute for a positive test.
- Parent export `/Users/a/Downloads/Audit - Round Dispatcher - Drain Useful Queue.json`
  verified exactly 10 nodes, v1, Asia/Bangkok, and cron at 08:00/16:30/19:00.
- Cloud rejected a three-hour timeout: this instance permits at most 40 minutes.
  Changed parent Settings to 0h40m and Save closed successfully. Local generated
  template and test updated to 2400 seconds. Still re-export to verify persisted
  timeout before publish.
- Parent remains DRAFT. Need an actual actionable queued job for the positive
  child/drain test; current queue empty. Do not reset completed jobs merely to
  consume executions for a test. Old worker timer remains enabled until verified.

- Proposed start times: 08:00, 16:30 (before the 17:00 case hand-off), 19:00,
  Asia/Bangkok. Telegram's separate report times remain unchanged.
- Parent runs queue refresh once, reads only actionable queued jobs, and invokes
  the existing Worker as a sub-workflow only if work exists.
- Wait for one job to finish before checking the queue again. Never increase
  the Worker's claim size: its file references are designed for exactly one job.
- Child's sub-workflow entry bypasses queue refresh. Failed/needs-review files
  are not requeued continuously during the drain.
- Empty queue or busy claim stops the round. Infrastructure errors stop visibly,
  not by an unlimited retry loop. SQL attempt limits, archive filters and atomic
  claiming remain intact.
- 500 calls / 40-minute parent ceiling raises an error rather than claiming success.
  This is a circuit breaker, not proof all backlog can finish in that time.
- Files arriving after a finished round wait for the next round, unless an
  operator manually starts a new round. Mail ingestion is unchanged.

## Artifacts and deploy order

Run `npm run build:rounds` and `npm test` first. These are templates, NOT exports
of production credentials. Placeholder credentials must be bound in n8n.

1. Back up/export current Worker dLkbNHgk3xMy9p82 and preserve its named version.
2. On that SAME Worker, add `รับงานจากรอบตรวจ` (Execute Sub-workflow Trigger,
   accept all data) connected to `รวมเป็นหนึ่งรอบ`. Enable Always Output Data on
   `Supabase: จองหนึ่งงาน`. Apply the small final summary code in
   `audit-round-worker.json`. Preserve existing PDF code and credential bindings.
   Keep the old timer temporarily until the new parent is verified.
3. Create ONE new parent from `audit-round-dispatcher.json`, bind its two HTTP
   nodes to the existing Supabase credential. Confirm target Worker ID and
   timezone. Do not paste it alongside an existing chain.
4. Test child-call permissions, empty queue (zero child calls), one actual queued
   job and multiple distinct jobs. Compare database job IDs, parse results and
   exception counts. A passed local graph/simulation test is not this live test.
5. Only after success publish the parent FIRST and confirm its schedule is
   enabled; then disable the old 10-minute trigger on the SAME Worker and
   publish the Worker. Inspect other active queue-only or
   duplicate Worker workflows before claiming all empty checks were eliminated.
6. Verify the next scheduled round in Executions, and a complete queue drain.
   Revert to the previous named Worker version if parent scheduling fails.

No Telegram message, case closure, amount/date change, RLS change, or deletion
is part of this scheduling change.

## Cost scope

Three parent schedule checks/day instead of 144 Worker timer calls/day reduces
this component's scheduled starts by about 97.9%. Not a promise about total
account spend: ingestion, notifications, OCR/storage and other flows remain.
Official n8n documentation states sub-workflow executions do not count toward
monthly execution limits:
https://docs.n8n.io/flow-logic/subworkflows/
