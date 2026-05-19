# UPDATE_CONTEXT_PACKAGE_PROMPT

A reusable Claude Code prompt. Run this in Claude Code when the `docs/context/` package has gone stale after meaningful repo changes.

Copy everything inside the fenced block below into a fresh Claude Code session.

---

```
You are working in this repo:

C:\Users\ianbe\OneDrive\Custom Programs\SAR_POD_Calc_v3.0

Goal:
Refresh the docs/context/ GPT context package so it reflects the current state of the repo. This is documentation-only work — no app behavior changes.

Context:
docs/context/ contains a planning context package that gets zipped and uploaded into a fresh ChatGPT session as the project's persistent memory. After meaningful repo changes (new functionality, storage changes, deployment changes, workflow changes, etc.), these docs go stale and need updating. Each file in docs/context/ explains its own purpose; read them before editing.

Files to inspect before making changes:
- docs/context/START_HERE_FOR_GPT.md
- docs/context/REPO_MEMORY.md
- docs/context/APP_CAPABILITIES.md
- docs/context/ARCHITECTURE_OVERVIEW.md
- docs/context/GPT_CLAUDE_WORKFLOW.md
- docs/context/CHANGELOG_CONTEXT.md
- docs/context/CONTEXT_PACKAGE_MANIFEST.md
- docs/context/KNOWN_TERMS.md
- docs/PSAR_POD_Field_Assistant_ChangeLog.md (if present)
- README.md
- package.json
- index.html
- service-worker.js
- _headers
- manifest.webmanifest
- src/main.js (especially the UPLOAD_ENDPOINT constant and the upload/route functions)
- src/model/podEngine.js
- src/model/reportData.js
- src/model/configLoader.js
- src/storage/db.js
- src/ui/render.js
- src/ui/imageViewer.js
- config/SAR_POD_V3_config.yaml
- tests/

Tasks:

1. Inspect the current repo state.
   - Run: git status --short
   - Run: git log --oneline -10
   - Note any new files, deleted files, renamed files, or modifications since the last context refresh.
   - Note any cache name, upload endpoint, IndexedDB schema, or do-not-change-list-related changes.

2. Update docs/context/REPO_MEMORY.md.
   - Re-verify every fact in the "Project", "App type", "Run locally", "Tests", "Deployment", "Data and storage", and "Report and upload model" sections against the actual repo state.
   - Update the "Known risks and follow-ups" section: remove items that are now resolved, add new items that have emerged.
   - Update the "DO NOT CHANGE WITHOUT EXPLICIT DIRECTION" list only if the load-bearing surface has genuinely changed.
   - Keep tone concise and load-bearing. This is the core memory file.

3. Update docs/context/APP_CAPABILITIES.md only if user-facing functionality changed.
   - New buttons, new flows, new visible behavior, new error states, new offline behavior, new PWA behavior — all in scope.
   - Update the "What the app does NOT yet do" section to reflect anything that's now implemented.
   - Do not invent capabilities. Only document what's actually in the repo.

4. Update docs/context/ARCHITECTURE_OVERVIEW.md only if architecture changed.
   - New modules, new directories, new entry points, changed routing, changed service worker strategy, new storage, new fetch destinations, etc.
   - Keep the "Future direction (not yet implemented)" section accurate — promote items from "future" to "current" only when they actually ship.

5. Append to docs/context/CHANGELOG_CONTEXT.md.
   - Add a newest-first dated entry for this refresh.
   - Describe the planning-relevant changes since the last entry (repo state, deployment state, doc state, workflow state, pending items).
   - Update the "Pending items to track" section: remove resolved items, add new ones.
   - Do NOT rewrite earlier entries.

6. Append to docs/PSAR_POD_Field_Assistant_ChangeLog.md if and only if user-facing app behavior changed.
   - This is the canonical user-facing changelog.
   - If only context docs / deployment config / tests changed, do NOT touch this file.

7. Update docs/context/CONTEXT_PACKAGE_MANIFEST.md only if the package's file list, recommended optional files, or zip recipe changed.

8. Update docs/context/KNOWN_TERMS.md only if new project-specific terms entered common use.

9. Preserve docs/context/START_HERE_FOR_GPT.md unless the GPT ↔ Claude Code workflow itself needs to change.
   - This file is the entry-point briefing. It should change rarely and only when the operating model changes.
   - If it does change, note that explicitly in CHANGELOG_CONTEXT.md.

10. Preserve docs/context/GPT_CLAUDE_WORKFLOW.md unless the workflow itself needs to change.

11. Preserve docs/context/UPDATE_CONTEXT_PACKAGE_PROMPT.md unless the refresh procedure itself needs to change.

12. Run npm test and report the result.

Hard constraints:
- Do not change POD math.
- Do not change report calculations.
- Do not change report payload structure.
- Do not change IndexedDB storage.
- Do not change the upload endpoint.
- Do not change service worker behavior unless necessary.
- Do not restructure the repo.
- Do not introduce Vite, React, TypeScript, Tauri, Electron, or workspaces.
- Do not integrate the desktop app.
- Do not move Worker source into this repo.
- Do not remove or rename sar_v2_session.
- Do not add secrets, tokens, credentials, or Cloudflare API details.
- Do not edit any source file under src/, config/, tests/ as part of this refresh. Documentation only.
- Do not invent state. If something is uncertain, leave the prior text and flag the uncertainty in CHANGELOG_CONTEXT.md.

Acceptance criteria:
- docs/context/REPO_MEMORY.md cache name, upload endpoint, IndexedDB schema, and deployment state match the current repo state.
- docs/context/CHANGELOG_CONTEXT.md has a new dated entry at the top describing what changed since last refresh.
- docs/PSAR_POD_Field_Assistant_ChangeLog.md was either appended to (if user-facing behavior changed) or left untouched.
- npm test exit code is 0 (if tests pass) — or the test status is reported clearly and matches REPO_MEMORY.md's "Last known status" line.
- No code files under src/, config/, tests/ were modified.

Final response:
Report:
- Files changed in docs/context/
- Whether docs/PSAR_POD_Field_Assistant_ChangeLog.md was updated and why or why not
- Key state changes captured (cache name, upload endpoint, deployment state, do-not-change list deltas)
- Whether npm test was run and the result
- Any uncertainty that was flagged in CHANGELOG_CONTEXT.md
- Files NOT changed that GPT might still expect to be different (and why)
```

---

## How to use this prompt

1. **Trigger.** Use `GPT_CLAUDE_WORKFLOW.md`'s "Context maintenance triggers" checklist. If any item is true, run this prompt. Otherwise don't — small changes don't need a refresh.
2. **Run.** Paste the fenced block into a fresh Claude Code session (or send it as a new prompt in an existing session).
3. **Review.** Read Claude Code's summary against the acceptance criteria. Verify the `REPO_MEMORY.md` updates match the actual change you triggered.
4. **Re-zip.** Once the refresh is accepted, rebuild the context zip per the recipe in `CONTEXT_PACKAGE_MANIFEST.md`.
5. **Hand it back to GPT.** Upload the fresh zip into the GPT chat (or start a new chat).

## When NOT to run this prompt

- Bug fixes that don't change visible behavior or load-bearing structure.
- Copy / wording tweaks.
- Comment-only changes.
- README spelling fixes.
- Test additions that don't change the engine's API.
- Any change where the answer to "did anything in `REPO_MEMORY.md` go stale?" is clearly no.

If in doubt, run it. The cost is one Claude Code session; the cost of working from stale GPT context is much worse.
