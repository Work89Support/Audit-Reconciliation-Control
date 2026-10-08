# Audit UI design contract

This document covers the existing Audit Reconciliation interface, not new financial policy.

## Tokens and variants

- Source of truth: `styles.css :root`. Kanit locally bundled, system sans-serif fallback.
- Text: `--text`; secondary: `--muted`; actionable text: `--blue-dark`.
- Status: `--green-txt`, `--amber-txt`, `--red-txt`. Never communicate status with colour alone.
- Headings: h1 28px (22px on small screens), h2 19px, h3 15px.
- Spacing scale: 4, 8, 12, 16, 24px. Use spacing tokens for new components.
- Radius: controls 8px; standard panels `--radius` 10px; cards 12px; dialogs 14px. These are intentional variants, not interchangeable defaults.
- Primary button: one next task per region. Secondary actions use ghost buttons; destructive decisions require explicit wording.
- Compact desktop controls may use 30/34px variants. Mobile buttons and primary links use at least 44px height; maintain separation between neighbouring targets.

## States and accessibility

- Provide hover, pressed, disabled, visible keyboard focus and pending feedback.
- Pending network work must not imply success. Keep user input after failure.
- Field validation is placed next to the field; uncertain server errors use a persistent form-level summary rather than blaming an arbitrary field.
- Normal text contrast target: at least 4.5:1. Recalculate against the actual background before adding a new colour pair.
- Dialogs move focus in, contain Tab navigation, restore focus on close, and make the background inert. Escape closes only the top layer.
- Tab groups support arrows/Home/End and a single keyboard tab stop.

## Layout and verification

- Tables may scroll within their own region; the page should not overflow at 320/375px.
- Preserve column labels during table scrolling. Do not truncate evidence identities on mobile.
- Verify 200% text and 400% zoom; do not disable browser zoom.
- Mobile navigation state/label must match visual state after opening, closing, resizing and route changes.
- Before release: use an isolated fixture and test accounts, never production customer data. Unit tests are not end-to-end approval tests.
