# Little Days — active capture-first contract (05:10 / 05:15 UTC)

Owner's latest direction SUPERSEDES every preview/send-gate design. No mandatory Listen/Send/Confirm step for daytime capture. Trial backend, original media, manual diary versions and books remain intact. One integration writer; new complete UI stays LOCAL until independent acceptance, then one preview update.

## Primary experience
Open straight to a living paper-note wall. Fixed, unmistakable Speak / Write / Photo. No classification or filter form before capturing. Tap a note for detail, playback, optional edits and receipts; no inline players or rows of actions on the paper.

Speak: tap immediately requests/starts one microphone session. Requesting/recording/stopping state is single-flight. A clear Stop automatically keeps original sound and queues saving; transcription follows. No preview/send gate. Photo: tap native image/video chooser; returned selection queues capture immediately. Cancel creates no note. Write: focus a paper editor; keystrokes persist locally under one draft ID/revision. Return/close/keyboard Done automatically queues that same note. Empty text creates no note. Listening and correcting words happen later in detail.

One current editable draft, plus immutable completed captures in the existing local IndexedDB outbox. Previous upload never blocks a new completed capture or clears its content. Persist locally before claiming collected; only server confirmation says saved. Failed capture remains a paper with retry. Requests do not silently overwrite another note or discard edits. Stop/hidden/close invalidate pending microphone action tokens and release late streams. No hidden live microphone kept to suppress permission prompts; no permanent-one-prompt claim.

## Visual system
Warm notebook background #FAF7F1, surface #FFFEFA, UI ink #26392D, secondary #687168, action #315943, separator #E5E5D9, error #A23E3A. Chinese system sans16px/1.65 and controls16px/600; headings28–32px. Desktop content max680px; mobile gutter16px. One light navigation system; brand/family quiet, no dead ✳ or logout action in header. Logout stays Family end. No stacked navigation/widget matrix.

Paper wall: two columns on390px, one column where320px requires, three desktop columns; chronological date groups, no random masonry order or movable whiteboard. Entry IDs deterministically assign at most4 colours: #F6E9AB/#FBF3D7/#E6EBD5/#F3DFD9. Paper corners2px, no thick frame or nested card, natural contact shadow, subtle grain/colour variation, occasional8–12px folded corner. Stable tiny rotation <=0.6deg only. Traditional handwritten body18–20px/1.65–1.75 in WenKaiTC, Kai fallback, deep ink #3E4431. Summary4–6lines. Author/time outside in14–16px system sans. displayText once: user text else one transcription; originals and other content stay in detail. Raw-only audio has a quiet label, no player on wall. Photos are not boxed into another card.

Navigation/filtering are secondary, never prerequisites. Diary dates open directly; Books use the existing two-day selection→readable preview→save/reopen flow (evening organization may preview). Cover/template/order remain optional adjustments. Preserve existing family privacy and author/time browsing without adding people/place categories.

## Acceptance
Say→Stop auto-collected; Photo selection auto-collected; Write closes without Send and remains durable. Queue failure/reload/concurrent captures/late acknowledgments do not lose content. New note statuses distinguish local collection from server save. Paper shows one content copy.320/390px and keyboard/dock are usable; two-day books still preview/save/reopen. Node recorder/transport doubles, real browser and physical device evidence are distinct. Physical mic/embedded browsers untested until an operable device exists.

No material certification, moderation or public-review scope. No new service or billing. Source data links are normal app functions, not authenticity proof.
