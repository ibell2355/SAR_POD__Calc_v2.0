# Future Architecture Notes

Forward-looking principles that should guide later phases of the SAR POD Calculator project. **Nothing here is implemented yet.** This document exists so that Stage 1 (Cloudflare Pages takeover) does not paint the project into a corner that a later phase has to rip out.

If a future change conflicts with one of the principles below, re-evaluate the principle before working around it.

---

## 1. The server is a convenience and sync layer, not a dependency

Field reporting must never depend on the upload Worker being reachable. Every operation a searcher needs in the field — running the POD calc, generating a report, sharing a report with command — must work with the device fully offline and the server entirely unavailable.

The upload endpoint exists to make the desktop command app's life easier, not to gate the field workflow. If Cloudflare is down, if the Worker is misconfigured, if the team's data plan dies on a ridgeline, the phone still finishes the report.

Practical implication: any feature that *requires* a server round-trip to be useful is the wrong design. Offline-first or it doesn't ship.

---

## 2. Every uploadable report must also be exportable as a portable JSON package

The exact same payload the phone sends to the upload Worker today (`segmentUploadPayload(...)` in `src/model/reportData.js`) must eventually be available to the user as a **portable JSON report package** that can be moved by hand: pasted into a desktop app, attached to an email, copied onto a thumb drive, sent through a messaging app. No server in the loop.

The server upload should be one delivery mechanism among several, not the only path.

### Phone / PWA export surface (to add later)
- **Copy JSON to clipboard.** One tap. Same byte-for-byte JSON as the upload payload.
- **Share JSON text.** Via `navigator.share({ text: ... })` on devices that support it.
- **Download or share a `.json` file.** Generated client-side; `Blob` + `URL.createObjectURL` + `<a download>`, or `navigator.share({ files: [...] })` where supported.
- **Copy / share the plain-text human-readable report.** Already half-built (`segmentReportText(...)` produces the string; current Copy and Share buttons use it). Keep this behavior available alongside JSON export.

### Desktop command app import surface (to build in its own repo)
- **Paste JSON.** A textarea / paste handler that accepts the report package and ingests it.
- **Open / drag-and-drop `.json` file.** OS file picker and DnD both supported.
- **Optional: pull from the Cloudflare server.** Last in priority order. The server pull is a convenience, never the only way in.

---

## 3. One canonical report package, five surfaces

The same canonical JSON shape must power all of:

1. **Phone report view** — the in-app rendered report.
2. **Plain-text human-readable report** — derived from the canonical data.
3. **JSON export** — the canonical data, verbatim.
4. **Server upload** — the canonical data, verbatim, POSTed.
5. **Desktop import** — accepts the canonical data and re-renders / re-derives downstream artifacts.

Today the code already enforces this through `buildSegmentReportData(...)` as the single source of truth feeding both `segmentReportText(...)` and `segmentUploadPayload(...)`. **Preserve this property.** Any future feature that adds a new derived artifact (a CSV row, a PDF, an XML envelope) should derive *from* the canonical data, not from one of the other derived artifacts.

When the monorepo split happens (see §7), this canonical builder belongs in `packages/core`, and the canonical type belongs in `packages/shared`.

---

## 4. Stable identifiers for dedup / update

The current upload payload already includes:
- `report_id` — assigned when the segment is first created; persists for the life of the segment.
- `segment_key` — slugified segment name (`segmentKey()` in `src/model/reportData.js`).

These are the right primitives for dedup and update handling. Future server and desktop logic should standardize on the same pair:

- **Same `report_id` + same `segment_key`** → idempotent re-upload / update of an existing report.
- **Different `report_id` + same `segment_key`** → a new report for the same conceptual segment (e.g. a follow-up sweep).
- **Different `segment_key`** → a different segment entirely.

Do not introduce alternative identifiers (server-side surrogate keys, timestamps as identity, etc.) when planning sync logic. They will fight with these and confuse three-way merges between phone, server, and desktop.

---

## 5. Desktop command app — out of scope here, but planned

- The desktop app will be evaluated and built **from its own repo** with its own context document, not from this repo.
- The desktop app **must eventually be buildable into an installable Windows EXE**. Tooling choice (Tauri vs. Electron vs. native vs. .NET) is open and intentionally deferred.
- The desktop app's job is to **consume report packages**, run command-side aggregation/visualization, and optionally write back to the same server. It does not duplicate field-entry UX.
- A future **Cloudflare-hosted desktop installer / download page** may be desirable so command staff can grab the latest EXE without poking around in GitHub Releases. Document this as a possibility; do not implement now.

---

## 6. Existing GitHub Pages deployment is the fallback through every stage

Until the desktop app and the canonical export/import path are in place, the GitHub Pages URL stays live as a rollback target. Stage 1 (Cloudflare Pages) explicitly keeps both deployments runnable side-by-side. Do not delete the GitHub Pages site until a later phase explicitly retires it.

---

## 7. Likely monorepo direction (deferred)

When code reuse with the desktop app becomes pressing, the working hypothesis for layout is:

```
apps/
  web/          # current PWA, moved here verbatim
  desktop/      # future desktop command app
worker/         # Cloudflare Worker for /api/reports (currently outside the repo)
packages/
  core/         # pure POD math, report builders, canonical data assembly
  shared/       # types/enums shared by web, desktop, and worker
```

What moves where:

- **`packages/core`** — `src/model/podEngine.js`, `src/model/reportData.js`, `src/utils/math.js`, `src/utils/simpleYaml.js`, the pure parse/validate half of `src/model/configLoader.js`.
- **`packages/shared`** — the upload payload type, the `segmentKey` slugger, the label maps that currently live inside `reportData.js`, the canonical `segment` and `searchLevel` schemas.
- **`apps/web`** — everything in `src/ui/`, `src/storage/db.js` (browser IndexedDB), the routing/event-delegation half of `src/main.js`, `index.html`, `manifest.webmanifest`, `service-worker.js`, `assets/`, and `config/` (or move config into `packages/shared/config/` if the worker also needs it).
- **`worker/`** — the upload endpoint's source. Currently lives in a separate Cloudflare project; relocate here when same-origin routing is set up in a later stage.

**Do not start any of this in Stage 1 or Stage 2.** Listed here only so individual file moves can be evaluated against this target shape when they come up.

---

## 8. Things this document is *not* committing to

- A specific JSON schema version field (likely needed, but not specified here).
- Conflict-resolution rules for the desktop app pulling a server copy that diverges from a locally edited copy.
- Authentication / authorization on the upload Worker.
- Encryption-at-rest on the server side.
- An offline upload queue / background sync on the phone (planned for Stage 6).
- Choice of bundler, framework, or workspace tool for the future monorepo.

These are all real questions. They get answered when the relevant stage starts, not pre-emptively.
