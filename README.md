# Accountability

A plain PHP accountability app for keeping a daily record with partners: shared goals, check-ins, reflections, and images. No router, Composer, vendor folder, npm setup, or build step.

The interface follows a **focused training log** direction: navy, warm white, yellow actions, condensed headings, and readable sans-serif text. Design decisions live in [.impeccable.md](.impeccable.md).

## Run

Serve this folder with an existing PHP-enabled web server and open `index.php`.

For a local preview:

```sh
php -S 127.0.0.1:8765 -t .
```

Open http://127.0.0.1:8765. Use localhost or HTTPS for Web Crypto. PHP 8.1+ with the Fileinfo extension is required for image validation. There is no application database to configure.

Click the **Demo-only credentials** row to fill both fields, then **Sign in**. A fresh browser receives three synthetic accountability partners and goals demonstrating current streaks, past streaks, sparse activity, and empty states. Existing chosen passwords are preserved unless you explicitly confirm switching to demo credentials.

## Find partners by goal

**Goals across your circle** lists active goals and how many distinct partners have them. Matching ignores case, spaces, and special characters, while preserving the original display names. Duplicate matching goals within one partner count once.

Click a goal to filter the partner cards. Matching partners remain prominent and switch to that goal’s carousel panel; other partners stay visible but gray out. Only one goal can be selected at a time. Choosing another replaces the current filter; clicking the selected goal again clears it. The **Filter on** bar displays the selection and a prominent **× Clear filters** button. Archived goals are excluded.

Click a partner card’s name, summary, or empty space to open its workspace. Carousel controls and the scrollable heatmap retain their own interactions; the Open workspace button also supports keyboard access.

## Check in and look back

- The workspace is divided into **Progress**, **Choose a day**, and **Notes & reflection**, with quick section links and a prominent selected date. Saved notes and the new-note composer have distinct visual treatments.
- Add, edit, archive, restore, or delete goals in each partner’s workspace.
- Each goal has its own heatmap and streak, with yesterday grace. Broken streaks show up to three recent completed runs.
- Use **Months** for a zoomed-out year view with monthly check-in and note counts. Empty months remain visible. Select a month to open its days.
- Use **Days** to select a date, including days without activity. A subtle vertical divider follows each Sunday, grouping the strip into Monday–Sunday weeks.
- Check in explicitly or let a saved note mark the day. The note checkbox defaults on. Deleting a note leaves its check-in intact.

## Rich notes and images

A compact, optional **Tags** picker sits above the full-width note editor. Choose several tags, remove selected chips with ×, or type a name and press Enter to create one. Write with bold, italic, underline, lists, or links. Existing plain-text notes remain readable and editable.

Use **Expand editor** for a nearly full-screen writing space. **Done editing** or Escape returns the same draft to its original form without saving or discarding it. Formatting and image controls work in either view.

Paste an image directly into the editor, use **Add image**, or reuse an upload through **My images**. Image-only notes are supported. Upload status and errors appear beside the editor; saving waits until uploads finish.

Supported formats: PNG, JPEG, GIF, and WebP, up to **8 MB** and **40 megapixels**. SVGs and non-image files are rejected. The server validates content instead of trusting filenames or browser MIME declarations.

Rich HTML is sanitized on save and display. Only approved formatting, safe links, and uploaded image identifiers survive; arbitrary attributes, scripts, remote images, and embedded content are stripped.

## Tag management and calendar colors

Tags belong to a goal and can be attached to multiple notes. Notes can have several tags or no tags.

- Search existing tags in the compact picker, choose several, or type a new name and press Enter. New tags receive a consistent default color.
- Use **Manage tags** beside the calendar legend to create tags, rename them, choose colors, and see how many notes use each tag.
- Rename/color changes update every use of the tag. Removing a tag asks for confirmation and removes only that tag’s references; note content stays intact.
- Calendar dates show one small colored dot per distinct tag used that day. The legend maps those colors to names, and accessible labels/tooltips list the names as well.
- Existing single-tag records are supported. Editing a note saves the new `tagIds` array without losing its prior tag.

## A separate image library for each partner

Open **Image library** from a partner workspace to see that partner’s uploaded images. From the partner-selection screen, the same control first asks you to choose a partner.

- Each library has its own random capability key and isolated server directory.
- A thumbnail shows the number of saved notes using the image.
- If there is one reference, clicking the image opens and focuses that note.
- If there are several references, clicking lists the matching partner/goal/date links. Choose one to jump to the note, including notes in archived goals.
- Uploads with no saved references remain visible and can be reused. Use **Not in a note** to show only those images. Open one and choose **Delete image** to remove the file. Cancelling an editor or deleting a note does not delete the uploaded file.

## Image storage and deployment

`api.php` is a single endpoint, with actions for upload, listing, deletion, and serving images. It includes `includes/uploads.php`; no router or dependency package is involved.

Uploads are saved under a **SHA-256 content hash plus a validated extension**, such as `<64-character-hash>.png`. Re-uploading identical bytes within a partner’s library reuses the file. Original filenames are not used as filesystem paths.

Default storage is `storage/uploads/<hash-of-library-key>/`. PHP needs permission to create and write this directory. For deployment, prefer a directory outside the document root:

```sh
ACCOUNTABILITY_UPLOAD_DIR=/absolute/private/path/accountability-images php -S 127.0.0.1:8765 -t .
```

Keep this path stable. The included `storage/.htaccess` denies direct access on Apache when overrides are enabled; on Nginx, deny `/storage/` in your site configuration or use the private directory above.

Set PHP `upload_max_filesize` to at least `8M` and `post_max_size` to at least `10M`. The application still enforces its own 8 MB file limit. Images are returned through `api.php` with explicit MIME types, `nosniff`, and a no-referrer policy.

## What is stored where?

| Data | Storage |
| --- | --- |
| Partners, goals, activity, tags, note text, sanitized HTML, image references | Browser IndexedDB: `accountability-app` |
| Salted password verifier | Browser IndexedDB |
| Per-partner image-library capability keys | Browser IndexedDB metadata |
| Uploaded image bytes | PHP server filesystem |
| Signed-in state | Browser memory only |

This remains a **local demo**, not production authentication. Capability keys grant access to a library; image request URLs include the key, so protect server logs and do not share those URLs. No cross-device note sync or account-based server login is provided. Clearing browser site data removes notes and library keys; server image files remain but that browser loses access to them. Keep the same browser profile and origin/port between visits.

**Reset demo** replaces seeded examples while preserving user-origin data and credentials. It does not delete uploaded files or library keys. User-created notes attached to demo partners keep their image references.

## Files

- `index.php`, `includes/head.php`, `includes/layout.php`, `includes/footer.php`: page shell.
- `api.php`, `includes/uploads.php`: image endpoint and storage validation.
- `js/app.js`: partners, goals, filtering, note navigation, and page rendering.
- `js/richText.js`, `js/images.js`: editor, HTML sanitizer, and upload/library client.
- `js/tags.js`: multiple-tag picker, legacy compatibility, color mapping, and date-dot aggregation.
- `js/dates.js`, `js/timeline.js`, `js/goalSummary.js`: date, timeline, and matching rules.
- `js/db.js`, `js/seed.js`, `js/demoAccount.js`: browser persistence and demo identity/data.
- `styles.css`: training-log design, responsive layouts, and interaction states.

## Verification

PHP syntax and upload/storage tests:

```sh
php -l index.php
php -l api.php
php -l includes/uploads.php
php tests/uploads.php
```

Optional developer tests (not needed to run or deploy):

```sh
TZ=America/Los_Angeles node --experimental-default-type=module --test tests/*.test.mjs
python3 tests/api.test.py
```

The Python integration test requires `php-cgi` and exercises actual multipart upload parsing and the real endpoint without opening a network socket. It verifies hashed names, deduplication, library isolation, byte-for-byte image retrieval, invalid types, HTTP methods, keys, and path traversal.

Browser checks exercised pasted-image upload through real PHP CGI, image rendering, image-only notes, reuse across multiple notes, note navigation, separate partner libraries, HTML sanitization, month/day selection, Sunday separators, goal filtering, carousel selection, clearing filters, multiple-tag edits, rename/recolor/create/remove actions, untagged notes, and responsive overflow at 390px.

The original Postop application and its storage remain untouched. Photos are no longer deferred: image attachments are now supported; export/import, server account authentication, automatic orphan-file cleanup, and cross-device sync remain future work.
