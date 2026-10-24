---
name: Bill-splitting product scope
description: User-provided product purpose and boundaries for the bill-splitting experience.
---

The product helps friends split a bill live while still sitting at the table, rather than tracking friends down afterward.

**Why:** This is the core problem stated in the user's idea; it distinguishes the app from ongoing expense tracking.

**How to apply:** Prioritize fast joining, shared-item selection, and clear provisional versus final amounts. The payer participates in the split too.

Initial participation requires no account creation. Payments occur outside the app using the payer's Venmo or Zelle details; login is a later addition.

**Why:** The user explicitly specified these boundaries in the original idea.

**How to apply:** Do not introduce signup gates or in-app money movement without a new request. Finishing selections must not imply verified payment.

The user anticipates the great majority of usage on phones and wants this product to take cues from Google or Apple native applications, with only essential explanatory copy.

**Why:** Their feedback on the initial prototype was that it contained too much decorative text and needed simpler, cleaner mobile interactions.

**How to apply:** Prioritize readable mobile text, generous touch targets, and easy numeric entry. Preserve useful short instructions, not long thematic headings. Item splits should support dollar, percentage, and unit allocations as well as equal shares; tip entry should support percentages.

The payer defines each item's dollar, percentage, or unit method and total units before inviting friends. Friends claim only their own portion, never configure totals or assign for others.

**Why:** The user explicitly changed the workflow from collaborative allocation editing to payer setup followed by individual claims.

**How to apply:** Treat this as superseding the earlier equal-share/group allocation editor requirement. Preserve partial claims while the group is still choosing.

Joining and editing must remain stable while other people act; live updates must not interrupt name entry or require reopening an otherwise valid claim.

**Why:** The user reported that flashing name entry prevented use on both mobile and desktop, and requested queued simultaneous edits instead of lockouts.

**How to apply:** Keep unauthenticated join forms outside private-bill polling. Serialize valid claims against current capacity; distinguish real item/receipt changes from unrelated participant activity.

The host wants to adjust the receipt amount directly and add tip without a fees/discounts reconciliation workflow.

**Why:** Receipts may be uploaded before tip is added; requiring an exact match to the printed pre-tip total blocked ordinary use.

**How to apply:** Keep the pre-tip amount and added tip distinct, show the final total clearly, and retain exact cent reconciliation internally.

Receipt and tip review is a required payer checkpoint before Items, Group, or Invite become available.

**Why:** The user explicitly requested no sharing or access to those screens until the payer fully confirms a scanned receipt and its tip.

**How to apply:** Scanning is extraction, not confirmation. Keep the review flow gated across reloads; only the payer's explicit confirmation unlocks participation.
