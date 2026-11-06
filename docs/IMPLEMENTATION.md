# Implementation — November 6, 2026

The user's implementation request supersedes the original documents’ planning-only restriction. P0–P6 are implemented as a standalone PHP application in this folder; no Postop source or storage was copied, and no dependencies were upgraded. Nothing was committed, pushed, or published.

## Decisions

- Plain `index.php` with `includes/head.php`, `includes/layout.php`, and `includes/footer.php`; no router, Composer, vendor folder, package manifest, or build step. Native browser ES modules and CSS are served directly. PHP renders the shell; IndexedDB remains the only durable data store.
- Seed the public local demo account at boot. A Postop-style demo row fills username and password without submitting. Existing custom passwords are preserved unless the user explicitly confirms switching to demo credentials. Password verification uses Web Crypto; sessions are memory-only.
- Goals own daily check-ins and notes directly. Tags are per-goal. Photos and clinical entities are omitted.
- Heatmap is binary, Sunday-first, limited to 365 days or goal lifetime. Browser-local dates are used throughout.
- Tag + note creation marks activity by default, with an explicit per-note opt-out. Undo check-in does not remove notes, and deleting notes does not undo check-in.
- Seed marker prevents automatic resurrection of intentionally deleted examples. Reset demo is explicit and transactional, affects seed-origin records only, preserves user-origin rows, and anchors examples to the current local day. Account credentials remain unchanged.
- Archived goals stay editable when “Show archived goals” is selected and are excluded from partner cards.
- Export/import and factory reset are deferred; browser-local storage limitations are disclosed on sign-in and in README.

## Validation

Four automated domain test groups pass. Browser checks passed for account creation, sign-in after reload, partner/goal creation, tagged notes, auto check-in, persisted user data, demo reset isolation, idempotent re-seeding, unique activity-day writes, archive/restore, note editing/deletion without removing check-ins, cascading partner deletion, preserving a user check-in sharing a seeded day key, and no horizontal page overflow at 390px on both partner and goal screens. Separate `accountability-app` database confirmed, with salted password verifier and no plaintext password field.

Preview server startup was blocked by this execution environment. Browser checks instead intercepted a dedicated test origin and fulfilled requests with the actual local source files; this exercises browser ES modules, Web Crypto, DOM, and IndexedDB without changing deployment configuration.

## PHP entry point update

At the user’s request, replaced the HTML entry point with plain PHP includes and removed the npm package manifest. Run on an existing PHP server, or use PHP’s built-in server directly. Optional Node-based developer tests are separate from app setup and deployment. PHP lint and rendered-output checks passed.

## Rich notes, images, timeline, and design update

- Rich notes use additive `html` and `imageIds` fields; legacy `text` notes remain supported. No IndexedDB schema bump is needed.
- `api.php` and `includes/uploads.php` validate uploads and store SHA-256-named images. Browser notes remain canonical in IndexedDB; image bytes now live on the server.
- Each accountability partner has an isolated image-library key in metadata (`imageLibrary:<accountId>:<partnerId>`). Library thumbnails resolve references from current notes and can navigate into archived goals.
- Month overview and complete per-month day strips support empty dates and leap years. Day-strip separators follow Sundays.
- Goal summary buttons apply a single selected filter across normalized goal names (selecting another replaces it), dim nonmatching partner cards, switch matching carousel slides, and offer one-click clearing.
- The creator chose the focused training-log direction. Updated `.impeccable.md`, navy/yellow palette, condensed/sans-serif font pairing, and compact tags above full-width note editors.
- README updated with deployment/storage requirements and the one screenshot captured before the creator stopped capture. No further screenshots were taken.
- Ten automated JavaScript test groups, PHP upload unit checks, real PHP CGI endpoint integration checks, and browser interactions were used for validation. Image request URLs use per-library capability keys; this is a local demo, not server account authentication.

## Multiple tags and management

Notes now use an additive `tagIds` array; legacy `tagId` values are read until the note is edited. Tags are optional. The picker supports searching, selecting, removing chips, and creating a tag with Enter. The per-goal management panel supports create, rename, recolor, and confirmed removal while preserving notes. Calendar dots deduplicate the tags present on each date, with a named legend. Browser checks verified legacy conversion, three tags on one note, matching date dots, rename/recolor propagation, creation, removal preserving notes, untagged notes, and mobile management layout.

## Workspace hierarchy, expanded editor, and card navigation

- Introduced labelled Progress, Choose a day, and Notes & reflection regions with anchor navigation. Progress is compact; calendar navigation has a tinted surface and explicit selected date; the note composer is separated from saved notes.
- Expand editor moves the existing rich editor DOM into a large native dialog, preserving its draft, formatting, event handlers, and upload state. Done editing and Escape restore it to the original form. The outer edit-note dialog stays open when the expanded view closes.
- Partner-card non-interactive surfaces delegate to Open workspace. Nested controls, links, focusable scrolling regions, drag gestures, and text selection are excluded. The existing native workspace button provides keyboard navigation.
- Browser checks passed for named regions, expanded draft save/return/Escape, nesting within Edit note, 390px modal fit, card-name navigation, and carousel/heatmap independence. No screenshots were captured.
