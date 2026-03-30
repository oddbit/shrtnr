# Changelog

## 0.4.3

- Fixed mobile layout across all pages: dashboard, links, API keys, and settings now render correctly on narrow screens
- Dashboard bento grid stacks to a single column on mobile
- Links toolbar wraps gracefully with full-width "New Link" button
- Link items stack vertically so URLs and click counts stay visible
- API keys table switches to a stacked card layout per row
- Settings and integrations columns stack on small viewports
- Prevented horizontal overflow on the main content area

## 0.4.2

- Settings page now shows an Integrations section with links to the TypeScript SDK and MCP Server npm packages

## 0.4.1

- Deploy script resolves the D1 `database_id` at build time via `wrangler d1 list`, removing the need for a hardcoded ID in `wrangler.toml`
- Works for both the Deploy to Cloudflare button (forks) and Import from Git (existing repos)

## 0.4.0

- Replaced runtime migration system with Cloudflare's standard `wrangler d1 migrations apply` during deploy
- The `deploy` script in `package.json` now runs migrations before deploying, which Cloudflare auto-detects for one-click deploy and Workers Builds
- Migration command references the D1 binding name (`DB`) instead of the database name, so it works regardless of what each user names their database
- Removed `src/migrate.ts`: no application-level migration code runs at request time

## 0.3.4

- Automatic database migrations: the Worker applies pending schema changes on cold start, no CLI commands or dashboard configuration needed
- Compatible with existing deployments: detects migrations already applied by wrangler and skips them
- Reverted deploy command to plain `wrangler deploy` since migrations are now handled at runtime

## 0.3.3

- Fixed D1 migration gap: deploy script now applies pending migrations before deploying the Worker
- Updated README: one-click deploy instructions now include the required deploy command change in Workers Builds settings

## 0.3.2

### Bug fixes
- Analytics endpoint now returns 404 for nonexistent links instead of 200 with empty data

### Internal
- Extracted shared `ServiceResult` type, `json()`, and `fromServiceResult()` into `src/api/response.ts`, removing duplication across 8 files
- Removed dead `Click` type, unused `incrementClickCount` function, and redundant `top_links` type annotation
- Added 14 API tests: read-scope write denial, create-scope read denial, vanity slug redirects, invalid JSON body handling, and 404s for nonexistent resources

## 0.3.1

- Clarified Workers Builds setup: deploy command, build-time variables, and where to find the D1 database ID

## 0.3.0

### Mobile UI
- Responsive layout with slide-in drawer navigation on small screens
- Hamburger menu button in sticky mobile header
- Long URLs truncate instead of overflowing
- Progress bars hidden on mobile; numeric values remain visible
- API keys table scrolls horizontally rather than breaking layout

### Integrations
- Published `@oddbit/shrtnr-sdk` npm package for programmatic link management
- Published `@oddbit/shrtnr-mcp` npm package exposing link management to AI assistants via MCP stdio transport

### CI
- Shared release scripts in `scripts/` (`extract-changelog.sh`, `detect-releases.sh`)
- Unified `release-packages.yml` workflow covers both SDK and MCP releases via a dynamic matrix

## 0.2.0

### API keys
- App-managed API keys with SHA-256 hashed storage
- Dual authentication: Cloudflare Access (admin) and Bearer token (API keys)
- Scope-based authorization: create, read, or both
- API key management endpoints (create, list, delete)
- Per-user key isolation with owner-only deletion
- Raw key shown once at creation, prefix stored for display
- Automatic last-used tracking on each API call
- Admin UI page for key management with table overview, create/delete, and scope badges

### Vanity slugs
- Limit to one vanity slug per link
- Removed DELETE endpoint for vanity slugs

### Theme
- Semantic on-color CSS variables (--on-primary, --on-secondary, --on-danger) for consistent contrast across all themes
- Fixed light theme: buttons, toasts, and badges now render with correct text color

### Release
- Added concurrency guard to GitHub Actions release workflow

## 0.1.0

Initial release.

- URL shortening with auto-generated and vanity slugs
- Click analytics with country, referrer, device, and browser tracking
- Dashboard with top links, recent links, and country stats
- Link detail page with performance breakdown and QR code generation
- Disable/enable links via expiry timestamps
- Per-user theme switching (oddbit, dark, light)
- Settings page with slug length configuration and update checker
- Cloudflare Access authentication
- URL-based admin routing with browser history support
