# Original statement canvas preview

Replaces browser-native PDF iframes in the cross-day workbench and head review
with the repository's bundled PDF.js renderer. Page controls and zoom operate
on the original PDF; no reconciliation rows or source amounts are edited.

Reads use the existing authenticated, user-scoped download snapshot. A copy of
the buffer goes to PDF.js so transfer cannot detach the cached original. Closing
or replacing the preview destroys its worker/render task. PDF passwords are
transient input only and are never persisted. PDF JavaScript evaluation is disabled.

Mock renderer tests cover paging, zoom, buffer preservation, disconnect cleanup
and read failure messaging. Live original PDF pixels must be checked after deployment;
unit tests do not prove rendering or a customer attachment write.
