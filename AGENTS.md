# Project instructions

- Deploy this site with Cloudflare Workers using `wrangler.jsonc` and Workers Builds. The Worker name is `power0802m-com`, the static asset directory is `public`, and the production Git branch is `master`. Keep the dashboard Worker name aligned with the Wrangler name. The production Custom Domain is `power0802m.com`; retain its route and the disabled production `workers.dev` setting in Wrangler.
- Run `npm run deploy:check` for deployment configuration changes. Never commit credentials or `.dev.vars` files.
- Keep the footer email as plain text; do not turn it into a mail link.
- After completing each user-requested set of website changes, run `npm run version:bump` once before final verification. This increments the patch version in both `package.json` and the footer (for example, v0.0.1 → v0.0.2). When the user explicitly requests an exact version, set that version in both files without an additional increment.
- Do not increment again for intermediate edits or fixes made while completing that same request. Read-only work, opening the preview, and documentation-only changes do not need a version increment.
- Keep the package version, package-lock root versions, and visible footer version identical. The version script validates and updates all three files together.
