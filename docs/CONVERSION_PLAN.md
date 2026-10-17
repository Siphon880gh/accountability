# Accountability App — Conversion Plan (from Postop)

> **Status:** Planning only. Do **not** implement, clone, migrate data, bump dependencies, commit, push, or open a PR from this document.
>
> **Source inspected (read-only, local):** `/Users/wengffung/dev/web/weng/app/postop` (GitHub reference: https://github.com/Siphon880gh/postop).
>
> **Target app root (future):** `/Users/wengffung/dev/web/weng/app/motivation/accountability` — currently docs-only.

## 1. Purpose and non-goals

### Purpose

Adapt Postop’s clinical wound-progress viewer into a **personal accountability** app where:

- Selection entities are **accountability partners** (not patients).
- Each partner card on the selection screen shows a **GitHub-style activity heatmap** and streak summary.
- If a partner has **multiple goals**, heatmap + streak UI live in a **per-goal carousel** inside the partner card; a single goal must **not** wrap in an unnecessary carousel.
- The left rail lists **Goals** (replacing progress libraries / wound-type libraries).
- Users attach **tags**, each followed by a **note**; tags surface as **note-badge-style badges on date-notes**.
- Persistence is **IndexedDB only** (no server database). Local demo identity only (see companion seed plan).

### Non-goals (this plan / this phase)

- No application code changes, no clone of the repo into `accountability/`, no IndexedDB seeding yet.
- No MySQL/SQLite/Firebase/remote API as source of truth.
- No tech-stack upgrades or new dependency versions unless the user explicitly asks later.
- No GitHub push / PR from agents (user handles publishing).
- No claim of production auth or HIPAA/clinical use (Postop already labels itself demo / not HIPAA).

## 2. Evidence from existing Postop (verified vs proposed)

### 2.1 Verified existing behavior (inspected)

| Area | Evidence | Location / notes |
| --- | --- | --- |
| Stack | Single-file PHP app (`index.php` ~2739 lines) + `accounts.php` (~149 lines); file-backed JSON under `storage/`; no framework/Composer | README, PLAN.md, `index.php` header |
| Auth | PHP session; demo username `admin`; password hashed via `password_hash` in `accounts.php`; credentials labeled demo on login UI | `accounts.php` `account_catalog` / `seed_account`; login HTML ~L1005 |
| Selection screen | `Patients` heading; `patient_picker()` renders `patient-card` articles with avatar, name, library count, diagnosis/account/age/gender/weight meta | `patient_picker` ~L1162–1163; CSS `.patient-card` / `.patient-picker` |
| Left rail | Aside “Progress libraries”; each `library-item` shows name, **type** (Pressure Injury / Mole Monitoring / Postoperative Wound / Custom), start date, optional library `note-badge` | HTML ~L1009; `library_save` allowed types ~L934 |
| Domain hierarchy | `Patient → Progress Library → Longitudinal Wound → Date-specific Wound Update → Angle Photos` | PLAN.md Domain model; seeded `record.json` shape |
| Notes | Scopes: library notes, day notes (`library.day_notes[date]`), wound day notes (`wound.day_notes[date]`); update notes migrated into wound day notes | `note_add`/`edit`/`delete` ~L940; migrations ~L745+ |
| Note badges | Class `note-badge` on library items and **date chips** via `date_count_badge()` / `.date-chip-badges`; accessible `sr-only` counts | ~L1051–1054, CSS ~L1599–1600 |
| Prefixed “tag-like” notes | Seeded texts `CONCERN:`, `CHANGE:` plus `app.config.json` `note_filter.presets` (`CONCERN:`, `CHANGE:`, `GAUZE:`) used as **quick note filters**, not first-class tag entities | `seed_demo_prefixed_notes`; `note_filter_presets_html` ~L1382 |
| Activity / streaks | **None.** No heatmap, contribution graph, or streak computation in source | Confirmed by search; no matches for streak/heatmap/carousel-as-product-feature |
| Client persistence today | IndexedDB DB name `skin-wound-viewer` with stores `meta` + `outbox` only; Cache Storage for offline photo/snapshot replica; server JSON remains canonical when online | JS `db()` ~L2516; PLAN.md offline rules |
| Seed versioning | `seed_version` on patient record (currently 4); additive seed helpers; account file under `storage/account.json` | `seed()`, `seed_version` checks |

### 2.2 Proposed (not in Postop today)

- Accountability **partners** as the top-level selectable entity.
- Partner-card **activity heatmap** (GitHub-style) and **current streak** or **last three streaks**.
- **Carousel** of goal heatmaps/streaks when partner has many goals.
- Left rail **Goals** instead of typed progress libraries / wound types.
- First-class **Tag + Note** pairs (tag then note body), rendered as badges on date-notes (inspired by existing `note-badge` / date-chip badges, not identical to filter presets).
- **IndexedDB as sole durable store** (no PHP `storage/` patients JSON as source of truth for the new app).

## 3. Domain remapping (source → target)

| Postop concept | Accountability concept | Mapping notes |
| --- | --- | --- |
| Patient | Accountability partner | Card on selection screen; rename UI copy and IDs |
| `patient-card` meta (Dx, account #, age, weight…) | Partner summary + **heatmap + streaks** | Clinical demographics drop or become optional non-clinical fields (display name, avatar, optional notes) |
| Progress library (+ type label) | **Goal** | Left sidebar list; type enum not required—goals are free-named; optional category later without stack change |
| Longitudinal wound | **Optional sub-track / check-in target** under a goal **or** fold away | Prefer **simpler v1**: Goal owns daily activity + tagged notes directly; wounds/photos out of scope unless user asks later |
| Date-specific update / photos | **Daily activity mark** for heatmap | One qualifying activity event per local calendar day per goal (see §6) |
| Prefixed note text (`CONCERN:`) | **Tag** entity + **note** body | First-class tag id/label; note stores `tagId` + text; badges show tag label |
| `note-badge` on date chips | **Tag badges on date-notes** | Visual language can reuse badge patterns; semantics = tags present that day, not “Notes N” count alone |
| Library type filter | Removed / replaced by goal list | User request: goals on the left instead of wound types |
| Sync-all / server outbox | **Out of scope for v1** | Local-only IndexedDB; document limitations (§8) |
| PHP accounts / roles | Local demo account record in IndexedDB | Companion seed plan; not production security |

## 4. Proposed information architecture and UI flows

### 4.1 Screens

1. **Sign-in (local demo)**  
   - Compact card; label credentials as local demo only.  
   - Validate against IndexedDB `accounts` (or equivalent) store.  
   - Session: in-memory + optional IndexedDB session token with expiry; **not** PHP sessions.

2. **Partner selection** (`Partners` replaces `Patients`)  
   - Grid of partner cards (reuse layout ideas from `.patient-picker` / `.patient-card`).  
   - Each card: avatar/name, goal count, then:
     - **1 goal:** inline heatmap + streak block (no carousel chrome).  
     - **2+ goals:** carousel (prev/next or dots), one slide per goal: title, heatmap, streak block.  
   - Streak block rules: if currently on a streak → show “On a streak · N days”; else → show up to **last three** completed historical streaks (length + approximate end dates).  
   - Open partner → partner workspace.

3. **Partner workspace**  
   - Breadcrumb: Partners / {name}.  
   - **Left:** Goals list (CRUD: add/edit/archive/delete with confirm).  
   - **Main:** Selected goal → calendar/timeline of days, date-notes with **tag badges**, affordance to log activity for a day, add tag+note pairs.  
   - Empty states: no goals; goal with no activity; day with notes but no activity (and vice versa)—all explicit.

### 4.2 Tag + note interaction (proposed)

- UX: “Add tag” then “Note” (tag followed by note), matching user wording.  
- Stored as linked pair; display on that date’s notes list as badge (`tag label`) + note text.  
- Date-level chrome: badges summarizing distinct tags that day (analogous to Postop date-chip `note-badge`, but tag-labeled).  
- Distinguish from Postop’s **string-prefix filter presets**—those remain inspiration only unless the user later wants filter chips.

### 4.3 Carousel accessibility / responsiveness

- Prefer native-friendly pattern: region with `aria-roledescription="carousel"` (or a labeled tablist if simpler), visible prev/next, keyboard operable, focus management when slide changes.  
- Do not autoplay.  
- Respect `prefers-reduced-motion` (instant slide, no decorative motion).  
- Mobile: partner grid collapses to 1 column (Postop already does similar at narrow breakpoints); heatmap must remain readable (scroll or scaled weeks).

## 5. IndexedDB schema (proposed)

Database name (suggested): `accountability-app`  
`schemaVersion` integer in a `meta` store; bump only with documented migrations.

### Stores and indexes

| Store | Key | Value (conceptual) | Indexes |
| --- | --- | --- | --- |
| `meta` | string | `{ schemaVersion, demoSeedVersion, lastOpenedAt, … }` | — |
| `accounts` | `id` | `{ id, username, passwordVerifier, displayName, createdAt, role? }` | `byUsername` (unique) |
| `sessions` | `id` | `{ id, accountId, createdAt, expiresAt }` optional | `byAccount` |
| `partners` | `id` | `{ id, accountId, name, avatarKey?, createdAt, archived? }` | `byAccount`, `byAccountActive` |
| `goals` | `id` | `{ id, partnerId, name, description?, startDate, createdAt, archived?, sortOrder }` | `byPartner`, `byPartnerActive` |
| `activityDays` | `id` (`goalId|YYYY-MM-DD`) or compound | `{ id, goalId, date, source, createdAt }` — **one row per goal per local date** | `byGoal`, `byGoalDate` (unique) |
| `tags` | `id` | `{ id, goalId or partnerId scope, label, color?, createdAt }` | `byScope`, `byLabel` |
| `notes` | `id` | `{ id, goalId, date, tagId, text, createdAt, updatedAt? }` | `byGoalDate`, `byTag` |

### Isolation from Postop patients

- Separate DB name from `skin-wound-viewer`.  
- Never read/write Postop `storage/patients/**`.  
- No shared object store names that imply clinical patients.  
- Copying UI patterns is fine; copying patient JSON is not.

### Password handling (plan-level)

- Store a **verifier** (e.g. Web Crypto salted hash), never plaintext.  
- Username for demo: `admin`.  
- Password: **the demo password supplied in the request** (do not hardcode plaintext secrets into future source comments or UI beyond the existing Postop-style “demo-only” disclosure if the user later asks for parity).  
- This is a **local-only demo identity**, not production authentication.

## 6. Activity heatmap and streak semantics

### 6.1 Day boundaries

- Use the **user’s local calendar date** (`America/Los_Angeles` for this user when testing; generally `Intl` / local TZ of the browser).  
- Store activity as `YYYY-MM-DD` strings already resolved in local time at write.  
- Do not use UTC midnight for “today” checks in UI.

### 6.2 Qualifying activity (dedup)

- A day counts for heatmap/streak for a **goal** iff an `activityDays` row exists for that `goalId` + date.  
- Logging multiple notes/tags the same day must **not** create multiple heatmap cells; upsert one activity day (or derive activity from “any note or explicit check-in”—**decide at implement time**; recommendation: **explicit check-in or any tagged note marks the day**, still deduped to one cell).  
- Recommendation default for v1: **explicit “Log today” / check-in** marks activity; adding a tagged note optionally auto-marks the same day (single toggle in settings later; default **on** for demo clarity).

### 6.3 Heatmap

- GitHub-style grid: weeks as columns (or rows), days as cells; intensity levels based on binary presence for v1 (level 0 empty / level 1+ active), optional later intensity if multiple events allowed.  
- Range: rolling ~52 weeks or since `goal.startDate`, whichever is shorter—document choice in implementation.  
- Empty days visible as muted cells (like Postop idle date chips).

### 6.4 Current streak

- Walk backward from **today**.  
- If today has activity → streak includes today.  
- **Yesterday grace:** if today has **no** activity but **yesterday** does, treat current streak as still alive ending yesterday (length counts consecutive days through yesterday). If both today and yesterday empty → current streak = 0.  
- Continuity: consecutive local dates with activity; gaps break the streak.

### 6.5 Last three historical streaks

- When current streak length is 0 (after grace rules), compute completed streak segments in the activity timeline (maximal consecutive runs), take the **three most recent** by end date, display length + end date (and optional start).  
- When current streak > 0, partner card emphasizes current streak; optionally still expose historical in expanded detail—not required on the card.

### 6.6 Goal-specific consistency

- Heatmap and streaks on the card are **per goal**, never merged across goals.  
- Partner-level aggregate streak is **out of scope** unless requested later.  
- Carousel slide N must match goal N’s data only.

## 7. Component / file mapping (future implementation guide)

When cloning/adapting (later), treat Postop monolith functions as conceptual modules:

| Postop artifact | Future accountability module (suggested) | Action |
| --- | --- | --- |
| Login HTML ~L1005 | `ui/login.js` + styles | Retheme copy; wire to IDB accounts |
| `patient_picker` / `patient-card` | `ui/partnerPicker.js` | Replace meta with heatmap+streak(+carousel) |
| Sidebar library list ~L1009 | `ui/goalSidebar.js` | Goals CRUD; drop wound-type enum requirement |
| Timeline / date chips / `date_count_badge` | `ui/goalTimeline.js` + `ui/tagBadges.js` | Date-notes + tag badges |
| Wound grid / photos / assessments | Deferred / omit in v1 | Photos not required for accountability MVP |
| `accounts.php` | `data/accountsIdb.js` | Local verifiers only |
| `seed()` / `seed_version` | `data/demoSeed.js` | See companion plan |
| JS `db()` meta/outbox | Expand IDB schema §5 | Primary store, not outbox-to-server |
| `app.config.json` note_filter | Optional `config.json` for default tag suggestions | No dependency bump; static JSON fine |
| PLAN.md / PRODUCT_PLAN.md | This docs set | Keep plans in `accountability/docs/` |

**Architecture choice (to confirm at implement):** keep a thin static shell (`index.html` + modular JS) **or** a single-file approach like Postop. Either is fine; **do not** introduce a framework without an explicit user ask.

## 8. Persistence constraints and browser limits

- **Local-only:** no cross-device sync, no server backup.  
- Clearing site data / “Clear cache” / private browsing wipes the database.  
- Storage quotas vary by browser; activity + notes are small, but avatars/blobs need quota checks.  
- Multiple profiles/browsers = separate databases.  
- Document a **Export / Import JSON** escape hatch as a later phase (not required for first seed).

## 9. Migration / isolation strategy

1. Create new app tree under `motivation/accountability` (later)—do not mutate Postop sources for product behavior.  
2. New IndexedDB name + schemaVersion starting at 1.  
3. If a future port copies Postop UI CSS, strip clinical strings and sync/PWA patient copy flows unless re-requested.  
4. Migrations: pure upgrade functions on `meta.schemaVersion`; never auto-import Postop `record.json`.  
5. Demo seed version tracked separately (`demoSeedVersion`) so schema migrations and demo content refreshes stay independent (see seed plan).

## 10. Phased implementation (when code is allowed)

| Phase | Deliverable | Exit criteria |
| --- | --- | --- |
| P0 | App shell, IDB open + schema, local sign-in | Sign-in round-trips; empty partner list |
| P1 | Partners + Goals CRUD | Create partner & goals; left rail works |
| P2 | Activity days + heatmap component | Cells reflect IDB; dedup enforced |
| P3 | Streak engine + card summary + carousel | Grace rules + last-3; single-goal no carousel |
| P4 | Tags + notes + date badges | Tag-then-note UX; badges on date-notes |
| P5 | Demo seed (companion plan) | Idempotent seed; acceptance tests pass |
| P6 | A11y/responsive polish | Keyboard carousel; contrast; reduced motion |

No framework/library upgrades in any phase unless requested.

## 11. Acceptance tests (manual / future automated)

### Partner card

- [ ] Partner with 0 goals: card shows empty heatmap/streak placeholder, no carousel.  
- [ ] Partner with 1 goal: heatmap + streak visible; **no** carousel controls.  
- [ ] Partner with 3 goals: carousel has 3 slides; each slide’s streak matches only that goal.  
- [ ] Active streak shows day count; broken streak (no today/yesterday activity) shows up to 3 prior streaks.

### Streak engine

- [ ] Consecutive days D-2..today → current = 3.  
- [ ] Activity yesterday only → grace keeps current streak alive.  
- [ ] Gap day breaks streak; historical segment retained.  
- [ ] Two activity writes same day → one heatmap cell / streak day.

### Goals & tags

- [ ] Creating a goal appears in left rail and as a carousel slide on the card.  
- [ ] Tag followed by note appears on that date; badge shows tag label.  
- [ ] Deleting a tag’s notes or archiving a goal does not corrupt other goals’ heatmaps.

### Persistence

- [ ] Reload restores partners/goals/activity from IndexedDB.  
- [ ] Postop `storage/` unchanged by this app.  
- [ ] No network database calls required for core flows.

### Regression / safety

- [ ] No dependency version bumps in lockfiles (if any appear later).  
- [ ] No push/PR from agent workflows.

## 12. Open assumptions (confirm before coding)

1. **Photos / wound assessments** are out of MVP (heatmap from activity/notes only).  
2. **Goals replace libraries**, and longitudinal wounds are not a separate entity in v1.  
3. **Tag scope** defaults to per-goal (not global).  
4. **Carousel** is horizontal slides with buttons/dots, not a free-scroll marquee.  
5. Heatmap uses **binary** intensity in v1.  
6. Day boundary = **browser local TZ**.  
7. Static/vanilla JS preferred to match Postop’s dependency-free ethos unless user asks otherwise.

## 13. Related document

- Demo account seed plan: [`DEMO_ACCOUNT_SEED_PLAN.md`](./DEMO_ACCOUNT_SEED_PLAN.md)
