# Project instructions

- Keep the footer email as plain text; do not turn it into a mail link.
- After completing each user-requested set of website changes, run `npm run version:bump` once before final verification. This increments the patch version in both `package.json` and the footer (for example, v0.0.1 → v0.0.2). When the user explicitly requests an exact version, set that version in both files without an additional increment.
- Do not increment again for intermediate edits or fixes made while completing that same request. Read-only work, opening the preview, and documentation-only changes do not need a version increment.
- Keep the package version and visible footer version identical. The version script validates this before updating either file.
