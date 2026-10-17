# Accountability App — Demo Account Seed Plan

> **Status:** Planning only. Do **not** seed IndexedDB, create accounts, or change application code from this document.
>
> **Companion:** [`CONVERSION_PLAN.md`](./CONVERSION_PLAN.md)
>
> **Credentials policy:** Demo username is `admin`. The password is **the demo password supplied in the request**. Do not reproduce that plaintext secret in chat summaries, commit messages, or unnecessary doc repetition. Treat this as a **local-only demo identity**, not production authentication.

> **Demo-login update:** The user requested Postop-style click-to-fill credentials. Fresh browsers now seed the public demo account automatically; the demo row fills both fields without signing in. Existing chosen passwords require an explicit confirmed switch. Public credentials are disclosed in the login UI and centralized in `js/demoAccount.js`; only salted verifiers are stored in IndexedDB.

## 1. Goals

Provide a **deterministic, idempotent, versioned** IndexedDB seed so a reviewer can sign in as the demo account and immediately see:

- Multiple accountability partners (and at least one with a single goal).  
- Goals with heatmaps that demonstrate **active streaks**, **three prior streaks**, **gaps**, and an **empty goal**.  
- Tag + note pairs and date-notes with tag badges.  
- Clear reset / re-seed behavior without touching any server database or Postop `storage/`.

## 2. Non-goals

- No real user PII; all names/avatars synthetic.  
- No server DB, PHP `storage/account.json`, or Postop patient import.  
- No sync across browsers/devices.  
- Do not implement seeding in this documentation pass.

## 3. Lessons from Postop seeding (verified)

Inspected `/Users/wengffung/dev/web/weng/app/postop`:

- Demo login labeled on UI; username `admin`; password hashed at seed into `storage/account.json` (`accounts.php` `seed_account`).  
- Patient seed uses `seed_version` (currently 4) with additive helpers (`seed_demo_photo_dates`, `seed_demo_prefixed_notes`) so upgrades can extend without full wipe.  
- Sample data uses **relative dates** (`today - N days`) so demos stay “fresh.”  
- Prefixed notes (`CONCERN:`, `CHANGE:`) demonstrate categorized notes—accountability will use **first-class tags** instead of string prefixes.  
- IndexedDB in Postop is **not** the clinical source of truth (only sync meta/outbox). Accountability **inverts** this: IDB is the source of truth; seed writes directly there.

## 4. Seed versioning and idempotency

### Meta keys

| Key | Purpose |
| --- | --- |
| `schemaVersion` | Object-store shape (owned by conversion plan) |
| `demoSeedVersion` | Integer content pack version for demo data |
| `demoSeededAt` | ISO timestamp of last successful seed |
| `demoSeedHash` | Optional hash of seed pack definition for drift detection |

### Algorithm (proposed)

1. Open DB; run schema migrations to current `schemaVersion`.  
2. Read `demoSeedVersion`.  
3. If equal to `DEMO_SEED_VERSION` constant **and** demo account + required entity IDs exist → **no-op** (idempotent).  
4. If missing or older → run `upgradeDemoSeed(from → to)` steps **or** `resetDemoNamespace()` then full seed (choose one strategy per major bump; document in changelog).  
5. Never delete non-demo user-created partners (see isolation below).  
6. Re-seed command / “Reset demo data” button (future UI) only affects records tagged `origin: 'demo-seed'`.

### Deterministic IDs

Use stable string IDs (not random UUIDs) for demo rows, e.g.:

- `acct-demo-admin`  
- `partner-alex`, `partner-blair`, `partner-casey`  
- `goal-alex-lift`, `goal-alex-read`, …  
- `tag-focus`, `tag-win`, `tag-blocker`  
- Activity keys: `goal-alex-lift|YYYY-MM-DD` with dates computed from a single `seedAnchorDate = localToday` at seed time.

Relative offsets are fixed integers in the seed pack; absolute dates materialize at seed runtime.

## 5. Demo account record

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | **the demo password supplied in the request** (store only a salted verifier in IDB) |
| Display name | e.g. `Demo Admin` |
| Role | `admin` (local flag only) |
| Flags | `isDemo: true`, `origin: 'demo-seed'` |

Sign-in UI may show username and a **demo-only** hint; whether the password is pre-filled or merely described should follow user preference at implement time. Prefer not painting secrets into screenshots/docs.

## 6. Illustrative dataset (content pack)

All activity dates are **relative to local “today” at seed time**.

### Partner A — `Alex Rivers` (multi-goal carousel showcase)

1. **Goal: Strength training** (active streak)  
   - Activity on: today, yesterday, and prior consecutive days for a **current streak of 5** (offsets 0..-4).  
   - Earlier gap, then a historical run (for completeness).  
   - Tags/notes: e.g. tag `Win` + note “Hit all sets”; tag `Focus` + note “Sleep was good.”

2. **Goal: Reading** (shows **three prior streaks**, current = 0)  
   - No activity today or yesterday (grace fails → current 0).  
   - Three completed runs, most recent first, e.g. lengths 4, 7, 2 ending at offsets -3, -12, -25 (exact offsets chosen so segments do not merge).  
   - At least one date-note with tag badge on a day inside a prior streak.

3. **Goal: Meditation** (gaps / sparse heatmap)  
   - Scattered single days with multi-day holes; no long current streak.  
   - Demonstrates empty-looking weeks with occasional cells.

### Partner B — `Blair Nguyen` (single goal — **no carousel**)

- One goal: **Job applications**.  
- Modest current streak (e.g. 2 days) so card shows heatmap + streak **without** carousel chrome.  
- Tag `Blocker` + note on an older day.

### Partner C — `Casey Ortiz` (empty / edge)

- One goal: **Language practice** with **zero** activity and **zero** notes → empty heatmap, streak 0, clear empty state.  
- Optional second archived goal (not shown in carousel) to prove archive filtering—optional.

### Tag catalog (demo)

Suggested labels (per-goal or shared demo tags): `Win`, `Focus`, `Blocker`, `Mood`.  
Each used at least once as **tag followed by note** on a dated note.

## 7. Isolation, reset, and migrations

### Isolation

- All seeded rows carry `origin: 'demo-seed'` (and/or id prefix `demo-` / stable ids listed above).  
- User-created data (future) uses different ids and `origin: 'user'`.  
- Reset demo **must not** wipe user rows.  
- Separate DB from Postop (`accountability-app` vs `skin-wound-viewer`).

### Reset flows (planned UX)

1. **Reset demo pack** — delete `origin=demo-seed` rows; set `demoSeedVersion=0`; re-run seed.  
2. **Factory reset** (dangerous) — clear entire IDB for this origin; confirm dialog.  
3. Logging out does **not** have to clear IDB (unlike Postop’s offline copy clear); document the difference.

### Migrations

- Schema bumps run before seed checks.  
- Demo content bumps via `demoSeedVersion` changelog, e.g.:  
  - v1: initial partners/goals/activity/tags  
  - v2+: additive notes or adjusted relative offsets  

## 8. Local-only limitations (must document in-app later)

- Data never syncs to another device or browser profile.  
- Clearing site data destroys the demo until re-seed.  
- Not a security boundary: anyone with device access can inspect IndexedDB.  
- Password verifier discourages casual reading of plaintext only; it is **not** production auth.  
- Quota / private mode: seed may fail—surface a readable error and retry.

## 9. Acceptance tests for the seed (when implemented)

- [ ] Fresh DB: after seed, sign-in as `admin` with **the demo password supplied in the request** succeeds.  
- [ ] Running seed twice does not duplicate partners/goals/activity (idempotent).  
- [ ] Alex has ≥2 goals; partner card uses carousel; Blair’s single goal has no carousel.  
- [ ] Alex / Strength shows current streak = 5 (or the documented length) with today or yesterday grace satisfied.  
- [ ] Alex / Reading shows current 0 and **three** prior streak summaries.  
- [ ] Casey empty goal shows empty heatmap and streak 0.  
- [ ] At least one date-note shows a **tag badge**.  
- [ ] Postop storage and DB untouched.  
- [ ] “Reset demo pack” restores the same deterministic structure after user edits to demo rows.  
- [ ] No plaintext demo password committed in source comments or markdown beyond the policy phrase above.

## 10. Implementation sketch (for a future coding pass)

```text
seedDemoIfNeeded(db):
  migrateSchema(db)
  meta = get(meta)
  if meta.demoSeedVersion == DEMO_SEED_VERSION and demoAccountExists(db):
    return { status: 'skipped' }
  in transaction:
    upsert account admin (verifier from supplied demo password)
    upsert partners A/B/C
    upsert goals, tags, notes
    materialize activityDays from relative offsets vs localToday()
    meta.demoSeedVersion = DEMO_SEED_VERSION
    meta.demoSeededAt = now()
  return { status: 'applied' }
```

Call from first app boot after IDB open, and from an explicit “Reset demo data” action.

## 11. Assumptions

1. Three partners are enough for the first pack.  
2. Relative offsets are preferred over fixed calendar dates.  
3. Demo password remains whatever the user supplied in the original request; docs refer to it only by policy phrase.  
4. No email verification, OAuth, or multi-account switcher in the demo pack.
