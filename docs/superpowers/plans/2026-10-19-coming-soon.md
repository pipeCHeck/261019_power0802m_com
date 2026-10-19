# Coming Soon Implementation Plan

> **For agentic workers:** Implement in the current session and verify the browser behavior before delivery.

**Goal:** Build a deployable, animated Korean coming-soon page for power0802m.com.

**Architecture:** Serve a buildless static page from `public/`. Use CSS grid layers and vertical slide keyframes for sequential message transitions, and a small deferred script for timing and dot updates. The user follow-up removes motion graphics and character illustrations.

**Tech Stack:** HTML, CSS, JavaScript, Node.js local preview.

**Spec:** `docs/superpowers/specs/2026-10-19-coming-soon-design.md`

## Global Constraints

- Preserve all five user-provided Korean phrases exactly.
- No external runtime dependencies or asset requests.
- Start with the first phrase and loop through the supplied order. Hold each phrase for 2400ms and slide for 650ms; cycle the trailing dots at 550 / 1.5 ms (approximately 366.7ms).
- Honor reduced motion and provide readable no-JavaScript content.
- Cloudflare Pages output directory is `public` with no build command.

## Review Focus

- Long Korean text must fit 320px viewports without horizontal scrolling.
- Every phrase must appear in order, including the fifth-to-first wraparound.
- Animation preference changes must stop and resume correctly.
- Preview paths must remain confined to `public/`.
- Local commits require a remote push before Cloudflare can deploy.

### Task 1: Build and verify the page

**Files:** `public/index.html`, `public/styles.css`, `public/app.js`, `public/favicon.svg`, `public/_headers`, `scripts/serve.mjs`, `package.json`, `.gitignore`, `README.md`.

- [x] Create the static page, responsive typography and phrase animation without motion graphics.
- [x] Add a dependency-free local preview command and Cloudflare Git setup instructions.
- [x] Open the preview and verify sequential phrase looping, dot cycle, mobile layout, reduced motion and no-JavaScript fallback in a real browser.
- [x] Review the resulting files and record verified limitations before handoff.

## Verification

Chrome browser checks passed for sequential phrase looping including wraparound, the dot cycle, live reduced-motion changes, stable heading height at six viewport widths, no-JavaScript fallback and the centered footer email. No browser errors occurred. The old graphic illustration and pause button remain removed. The sequential-loop browser check was observed failing against the previous static-message implementation before the new transition behavior was implemented.

Git has no configured remote, and Cloudflare account and domain access have not been connected. Files and instructions are ready; public deployment and commit-triggered builds have not been performed or verified.
