---
name: Bill-splitting product scope
description: User-provided product purpose and boundaries for the bill-splitting experience.
---

The product helps friends split a bill live while still sitting at the table, rather than tracking friends down afterward.

**Why:** This is the core problem stated in the user's idea; it distinguishes the app from ongoing expense tracking.

**How to apply:** Prioritize fast joining and shared-item selection. Show receipt item prices while choosing, but hide personal split amounts on My items for both roles until the payer closes the bill. The payer participates in the split too.

Both payers and friends use the name-only, no-login flow. Payments occur outside the app using the payer's Venmo or Zelle details.

**Why:** After trying email/password, the user explicitly and repeatedly requested removing login and restoring the pre-login experience. This supersedes all earlier Google and email/password requests. External payments remain part of the original scope.

**How to apply:** Do not reintroduce account or login requirements without a new explicit request. Use private per-bill browser sessions, not matching display names, to establish ownership. Preserve existing bill access when changing authentication. Do not introduce in-app money movement. Finishing selections must not imply verified payment.

The user anticipates the great majority of usage on phones and wants this product to take cues from Google or Apple native applications, with only essential explanatory copy.

**Why:** Their feedback on the initial prototype was that it contained too much decorative text and needed simpler, cleaner mobile interactions.

**How to apply:** Prioritize readable mobile text, generous touch targets, and easy item selection. Preserve useful short instructions, not long thematic headings. Tip entry should support percentages.

Each person selects the items they ate; each item is split equally among its selectors. No item-level dollar, percentage, or unit workflows remain.

**Why:** The user explicitly replaced payer-defined split methods with simple selection and approved converting positive claims on existing open bills to equal selections.

**How to apply:** This supersedes prior payer-defined dollar/percentage/unit requirements. Keep selections own-only, preserve closed bill amounts, and reset participant confirmations when converting open bills. Receipt and tip confirmation remains required.

Joining and editing must remain stable while other people act; live updates must not interrupt name entry or require reopening an otherwise valid claim.

**Why:** The user reported that flashing name entry prevented use on both mobile and desktop, and requested queued simultaneous edits instead of lockouts.

**How to apply:** Keep unauthenticated join forms outside private-bill polling. Serialize own-item selections; distinguish real item/receipt changes from unrelated participant activity.

Confirmation means approval of one's selected items, not a changing provisional amount. Other people joining, selecting a shared item, or confirming must not clear existing confirmations.

The Summary box's green state means everyone has confirmed, not that the bill is ready to close.

**Why:** The user explicitly wants green even when unclaimed items remain. Keep unclaimed counts and close-bill eligibility separate from confirmation color.

**Why:** The user found repeated reconfirmation and changing personal amounts disruptive, then explicitly required both payer and friend My items views to withhold personal dollar shares until the payer closes the bill.

**How to apply:** Only one's own selection edits clear one's own confirmation. My items is selection-only for both roles until closure: show original item prices, not personal totals, per-item dollar shares, or breakdowns—even if everyone has confirmed. The payer alone sees Summary and may see provisional amounts there while the bill remains open; do not repeat totals across tabs. Explicit receipt changes or the payer asking everyone to reconfirm remain distinct actions.

The host wants to adjust the receipt amount directly and add tip without a fees/discounts reconciliation workflow.

**Why:** Receipts may be uploaded before tip is added; requiring an exact match to the printed pre-tip total blocked ordinary use.

**How to apply:** Keep the pre-tip amount and added tip distinct, show the final total clearly, and retain exact cent reconciliation internally.

Receipt and tip review is a required payer checkpoint before Items, Group, or Invite become available.

**Why:** The user explicitly requested no sharing or access to those screens until the payer fully confirms a scanned receipt and its tip.

**How to apply:** Scanning is extraction, not confirmation. Keep the review flow gated across reloads; only the payer's explicit confirmation unlocks participation. Hide all desktop/mobile bill tabs until confirmation rather than showing disabled tabs; do not show the removed "Confirm the receipt and tip to unlock…" notice.

Keep the existing OCR provider. Prompt and receipt-reconciliation improvements are authorized; replacing the provider is not.

**Why:** After discussing alternative providers, the user said to keep the existing OCR. They later explicitly requested better auto-gratuity recognition and mathematically consistent totals.

**How to apply:** Do not bundle an OCR replacement with splitting or receipt UI work.

Automatic gratuities belong in gratuity, not fees or purchase items. Include actual additional tips once, and prefer item-based arithmetic over an inconsistent printed total.

**Why:** The user repeatedly reported missed auto-gratuities and unrelated totals, and asked for item totals as the fallback with a receipt-total cross-check.

**How to apply:** Treat the printed total as a check, not permission to invent a tip or adjustment. Only actual labelled charges count; suggested-tip tables do not. Missing or unreadable tips default to zero for payer review, and the payer can edit the extracted values directly. Do not show OCR confidence, mismatch, or amount/tip warning copy in the review UI.

Restaurant and bill names are not part of the user-facing Billo experience.

**Why:** The user later asked to remove restaurant and bill names entirely from what payers and friends see, overriding the earlier name-entry request.

**How to apply:** Do not display or request a restaurant/bill name in Billo pages, receipt review, invite/share text, or payment details. Keep required internal bill titles hidden. Suppress OCR warning copy in the review UI; keep extracted items, tax, tip, and total visible and editable. Keep the concise notice that receipt images are sent to the OCR provider.

Short invite URLs must be native to Billo, not Bitly or another external shortening provider.

**Why:** The user declined the Bitly integration and explicitly repeated that the URLs themselves should be shorter without Bitly.

**How to apply:** Preserve existing full links and bill sessions. Keep development links on their own origin; do not send development bill IDs to the production database just to shorten the domain.
