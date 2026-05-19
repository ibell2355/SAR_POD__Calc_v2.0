# CONTEXT_PACKAGE_MANIFEST

What's in this context package, what each file is for, and what to include when zipping it for a fresh GPT chat.

---

## Core files (always include)

These five files are the minimum viable context. Zip them every time.

| File | Purpose |
|---|---|
| `START_HERE_FOR_GPT.md` | Entry point. Tells GPT what its role is, what to read next, and how to operate. |
| `REPO_MEMORY.md` | Persistent core memory: project, app type, deployment state, storage model, do-not-change list. |
| `APP_CAPABILITIES.md` | What the app does and what it doesn't, from a user's point of view. |
| `ARCHITECTURE_OVERVIEW.md` | Technical layout: entry points, modules, routing, service worker, upload flow, future direction. |
| `GPT_CLAUDE_WORKFLOW.md` | The human-in-the-loop operating manual for Ian ↔ GPT ↔ Claude Code. |

## Supporting files (include with the core)

| File | Purpose |
|---|---|
| `CHANGELOG_CONTEXT.md` | Planning-relevant changelog. Newest-first. Catches GPT up on recent repo state changes. |
| `CONTEXT_PACKAGE_MANIFEST.md` (this file) | The index. Include so GPT can see what should be in the package and notice if anything's missing. |
| `UPDATE_CONTEXT_PACKAGE_PROMPT.md` | The reusable Claude Code prompt Ian runs to refresh this package after meaningful changes. Include so GPT can suggest running it when appropriate. |
| `KNOWN_TERMS.md` | Glossary of project-specific shorthand (SRPOD, POD, report package, segment_key, etc.). Useful even if optional. |

## Optional supporting docs from the repo

Add these to the zip when the session's topic calls for them. Don't reflexively include all of them — too much context is its own problem.

| File | When to include |
|---|---|
| `docs/PSAR_POD_Field_Assistant_ChangeLog.md` | **Always recommended.** The canonical user-facing app changelog. Add if GPT will be asked anything about app history or feature evolution. |
| `docs/FUTURE_ARCHITECTURE_NOTES.md` | When the session involves planning new features, the desktop app, JSON export/import, or any "where is this going" discussion. |
| `docs/CLOUDFLARE_PAGES_SETUP.md` | When the session involves deployment, hosting, CORS, the Worker, or anything Cloudflare-specific. |
| `docs/REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md` *(if present in the working tree)* | When the session involves the staged migration plan or historical Stage 1 context. |
| `docs/V3_RENAME_PREFLIGHT_AUDIT.md` *(if present in the working tree)* | When the session involves the GitHub repo rename, git remote changes, or stale v2 references. |

*Note: `REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md` and `V3_RENAME_PREFLIGHT_AUDIT.md` are not currently in the working tree as of the last context refresh — see `CHANGELOG_CONTEXT.md`. Ask Claude Code to regenerate them via the refresh prompt if a session needs them.*

## Files NOT to include in the zip

- **`docs/PSAR Brand Presentation.pdf`** — 11 MB binary, no value for a planning chat.
- **`assets/`** — images. Use screenshots from Ian when needed.
- **`node_modules/`, `.git/`, `.claude/`** — never include.
- **Any code file under `src/`, `config/`, `tests/`** — let Ian paste specific files when a session needs them. Pre-loading source code into GPT bloats the context window and goes stale fast.

---

## How to assemble and use the package

### Suggested zip recipe

Working from the repo root in PowerShell:

```
Compress-Archive `
  -Path "docs\context\*", `
        "docs\PSAR_POD_Field_Assistant_ChangeLog.md", `
        "docs\FUTURE_ARCHITECTURE_NOTES.md", `
        "docs\CLOUDFLARE_PAGES_SETUP.md" `
  -DestinationPath "srpod-gpt-context.zip" `
  -Force
```

Adjust the paths to include only what the next session needs.

### Loading the package into a fresh GPT chat

1. Open a new ChatGPT conversation.
2. Upload `srpod-gpt-context.zip` (or upload the individual `.md` files directly — both work).
3. First message: "Read `START_HERE_FOR_GPT.md` first, then `REPO_MEMORY.md`, then `APP_CAPABILITIES.md`. After that, tell me you're ready and ask what we're working on."
4. From there, work as described in `GPT_CLAUDE_WORKFLOW.md`.

### Keeping the package fresh

When Claude Code finishes a meaningful change to the repo, run the refresh prompt in `UPDATE_CONTEXT_PACKAGE_PROMPT.md`. That tells Claude Code which context files to update and what to leave alone.

A "meaningful change" trigger checklist lives in `GPT_CLAUDE_WORKFLOW.md` under "Context maintenance triggers".

---

## Quick sanity check before sending the zip

- [ ] `START_HERE_FOR_GPT.md` is in the zip and is named exactly that (case-sensitive on some systems).
- [ ] `REPO_MEMORY.md` reflects the current state (cache name, upload endpoint, deployment status).
- [ ] `APP_CAPABILITIES.md` reflects what the app actually does *now*, not what it might do later.
- [ ] No secrets, API keys, tokens, or Cloudflare credentials in any file.
- [ ] No `.env*` files, no `.git/` folder, no `node_modules/` folder.
- [ ] Total size is small (< 1 MB) — if larger, you're including something you don't need.

If any of these fail, run `UPDATE_CONTEXT_PACKAGE_PROMPT.md` first, then re-zip.
