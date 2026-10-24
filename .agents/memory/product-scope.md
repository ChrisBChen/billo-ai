---
name: Bill-splitting product scope
description: User-provided product purpose and boundaries for the bill-splitting experience.
---

The product helps friends split a bill live while still sitting at the table, rather than tracking friends down afterward.

**Why:** This is the core problem stated in the user's idea; it distinguishes the app from ongoing expense tracking.

**How to apply:** Prioritize fast joining, shared-item selection, and clear provisional versus final amounts. The payer participates in the split too.

Both payers and friends should have regular login rather than Google-only sign-in. Payments occur outside the app using the payer's Venmo or Zelle details.

**Why:** The user requested login for both roles, then replaced the Google-only request with regular login. External payments remain part of the original scope.

**How to apply:** Do not reintroduce Google-only login. Preserve the invited bill through login, and do not introduce in-app money movement. Finishing selections must not imply verified payment.

The user anticipates the great majority of usage on phones and wants this product to take cues from Google or Apple native applications, with only essential explanatory copy.

**Why:** Their feedback on the initial prototype was that it contained too much decorative text and needed simpler, cleaner mobile interactions.

**How to apply:** Prioritize readable mobile text, generous touch targets, and easy item selection. Preserve useful short instructions, not long thematic headings. Tip entry should support percentages.

Each person selects the items they ate; each item is split equally among its selectors. No item-level dollar, percentage, or unit workflows remain.

**Why:** The user explicitly replaced payer-defined split methods with simple selection and approved converting positive claims on existing open bills to equal selections.

**How to apply:** This supersedes prior payer-defined dollar/percentage/unit requirements. Keep selections own-only, preserve closed bill amounts, and reset participant confirmations when converting open bills. Receipt and tip confirmation remains required.

Joining and editing must remain stable while other people act; live updates must not interrupt name entry or require reopening an otherwise valid claim.

**Why:** The user reported that flashing name entry prevented use on both mobile and desktop, and requested queued simultaneous edits instead of lockouts.

**How to apply:** Keep unauthenticated join forms outside private-bill polling. Serialize own-item selections; distinguish real item/receipt changes from unrelated participant activity.

The host wants to adjust the receipt amount directly and add tip without a fees/discounts reconciliation workflow.

**Why:** Receipts may be uploaded before tip is added; requiring an exact match to the printed pre-tip total blocked ordinary use.

**How to apply:** Keep the pre-tip amount and added tip distinct, show the final total clearly, and retain exact cent reconciliation internally.

Receipt and tip review is a required payer checkpoint before Items, Group, or Invite become available.

**Why:** The user explicitly requested no sharing or access to those screens until the payer fully confirms a scanned receipt and its tip.

**How to apply:** Scanning is extraction, not confirmation. Keep the review flow gated across reloads; only the payer's explicit confirmation unlocks participation. Hide all desktop/mobile bill tabs until confirmation rather than showing disabled tabs; do not show the removed "Confirm the receipt and tip to unlock…" notice.

Keep the existing OCR provider and scanning implementation unchanged unless the user explicitly authorizes a future change.

**Why:** After discussing alternative providers, the user said to stop changing OCR and keep it as is.

**How to apply:** Do not bundle an OCR replacement with splitting or receipt UI work.

Short invite URLs must be native to Billo, not Bitly or another external shortening provider.

**Why:** The user declined the Bitly integration and explicitly repeated that the URLs themselves should be shorter without Bitly.

**How to apply:** Preserve existing full links and bill sessions. Keep development links on their own origin; do not send development bill IDs to the production database just to shorten the domain.
