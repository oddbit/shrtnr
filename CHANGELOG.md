# Changelog

## 0.25.0

- MCP endpoint moved from path-based (`/_/mcp`) to dedicated subdomain (`mcp.*`). CF Access MCP-type applications cannot be scoped to a path, so the Worker now detects requests on any `mcp.*` host and rewrites them to the internal `/_/mcp` handler. Paths reserved by Cloudflare (`/.well-known/*`, `/cdn-cgi/*`) are excluded from the rewrite.
- Updated README: MCP setup instructions now cover the subdomain requirement, Custom Domain registration, "Block AI bots" warning, and `claude.com` redirect URI. All client connection URLs updated from path-based to subdomain-based.
- Nine new MCP analytics tools: `get_trending_links`, `get_dashboard_stats`, `get_link_timeline`, `get_clicks_by_country`, `get_clicks_by_referrer`, `get_clicks_by_device`, `compare_links`, `get_link_breakdown`, and `get_total_clicks`. Each tool accepts a time range filter and configurable result limit.
- New `delete_link` MCP tool. Only links with zero clicks can be deleted; links with clicks should be disabled instead.
- Analytics service layer (`src/services/analytics.ts`) wraps the new repository queries with link existence checks and consistent error handling.

## 0.24.0 (2026-04-08)

### MCP auth switched to Cloudflare Access Managed OAuth

The custom OAuth provider (`@cloudflare/workers-oauth-provider`) is replaced by Cloudflare's built-in Access Managed OAuth. MCP clients now authenticate through a standard CF Access login flow instead of a Worker-managed OAuth handshake.

- Removed `src/mcp/access-handler.ts`, `src/mcp/approval-dialog.ts`, `src/mcp/oauth-types.ts`, and `src/mcp/workers-oauth-utils.ts`. The Worker no longer implements its own OAuth 2.1 server.
- Removed the `OAUTH_KV` binding and the six `ACCESS_*` OAuth secrets. MCP auth relies on the same `ACCESS_AUD` JWT verification used by the admin UI.
- The Durable Object (`McpAgent`) is removed. MCP sessions are stateless again.
- Extracted `isSignedIn()` helper in `access.ts` to share JWT-check logic between admin routes and the landing page redirect.
- Refined light theme color palette for better contrast.
- Updated dependencies and added `engines.node >= 22` constraint to `package.json`.

## 0.23.2 (2026-04-07)

**Bar chart percentages**: Bar widths now reflect each item's share of the total clicks rather than its share of the top item's count. Indonesia at 5 of 9 total renders at 55%, not 100%.

**Sources full URL**: The Sources card now shows the hostname in the bar row and the full referrer URL below it, matching the layout of the Most Clicked card.

## 0.23.1 (2026-04-07)

Fixing bar charts length.

## 0.23.0 (2026-04-07)

### Auto-label, analytics range filter, and link detail redesign

**Auto-label from page title**: When a link is created without a label, the Worker fetches the destination page's `<title>` in the background (via `waitUntil`) and saves it as the label. The link detail page polls briefly after creation and updates the label display without a reload.

**Analytics range filter**: The analytics endpoint accepts a `?range=` parameter (24h, 7d, 30d, 90d, 1y, all) and filters every breakdown query by that window. The link detail page re-renders all stat cards on each range change.

**Per-slug click counts**: `ClickStats` now includes `slug_clicks`, so the link detail page shows a click bar for each slug driven by a single analytics response.

**Link detail page redesign**: The range selector moves to the page header. Stat cards (countries, referrers, devices, OS, browsers, link modes) update on range change instead of being server-rendered. The inline label editor is promoted to the top of the hero section. The links list now shows the label above the slugs.

**Referrer host normalization**: The `www.` prefix is stripped from referrer hosts on click recording, so `www.linkedin.com` and `linkedin.com` attribute to the same host.

**Schema cleanup**: Removed the `link_click_count` and `qr_click_count` counter columns from the `slugs` table. Click counts derive from aggregate queries against the `clicks` table.

## 0.22.0 (2026-04-07)

### Click count refactor, dashboard top domains, and icon fixes

**Click counts from aggregate queries**: `click_count` on slugs is now computed via a subquery against the `clicks` table rather than maintained as separate `link_click_count` and `qr_click_count` counter columns. This keeps counts consistent with the analytics data and removes the need to update counter columns on every click.

**Dashboard top domains**: The "Top Sources" panel is renamed "Top Domains" and now groups by `referrer_host` instead of the full referrer URL, giving cleaner domain-level attribution.

**iOS and macOS icons**: The OS breakdown icons for iOS and macOS now use valid Material Symbols glyphs (`phone_iphone` and `laptop_mac`) instead of the broken `apple` ligature.

## 0.21.0 (2026-04-06)

### Expanded analytics and interactive timeline chart

**Richer click tracking**: Each click now captures OS (parsed from User-Agent), referrer host, and link mode (link vs QR). The database schema and `ClickData` type reflect these additions.

**New analytics panels**: The link detail page gains dedicated breakdown panels for referrer hosts, operating systems, and access method (link vs QR), alongside the existing country, device, browser, and channel breakdowns.

**Interactive timeline chart**: The static clicks-over-time bar chart is replaced with a range-selectable timeline. Choose 24h (hourly), 7d, 30d, 90d (daily), 1y (weekly), or all-time (monthly). A summary row shows totals for each preset period at a glance. The chart fills zero-count buckets so the series is always continuous.

## 0.20.0 (2026-04-06)

### Admin UI improvements

**Landing page redirect**: Authenticated users visiting `/` are now redirected to `/_/admin/dashboard` instead of seeing the public landing page.

**Smart search/shorten input**: The URL input on the links list and dashboard pages is now dual-purpose. Pasting a URL shortens it as before. Typing plain text searches existing links by slug or description. The button shows "Shorten" with a lightning bolt by default and switches to "Search" with a magnifying glass when non-URL text is detected. The placeholder text reads "Paste URL or search links..." to communicate both actions.

**Delete zero-click links**: Links with no recorded clicks now show a "Delete" button instead of "Disable". Deleting removes the record from the database. Links that have been clicked can still only be disabled.

**Removed broken "Create new" button**: The "Create new" button that appeared in search results was removed. It attempted to create a link from the search query string, which always failed URL validation.

## 0.19.0 (2026-04-05)

### Separated link creation from custom slugs

Link creation and custom slug assignment are now separate operations at every layer.

**HTTP API**: `POST /_/api/links` no longer accepts `custom_slug`. Links are created with a random slug only. Custom slugs are added one-by-one via `POST /_/api/links/:id/slugs`, which returns 409 on collision.

**Service layer**: `createLink` generates a random slug. `addCustomSlugToLink` handles custom slugs individually with validation and collision checking.

**SDK** (`@oddbit/shrtnr` 0.4.0): `createLink` no longer accepts `custom_slug`. Use `addCustomSlug` after creation. The return type is `Link` (removed `CreateLinkResult` and `SlugRejection`).

**MCP**: `create_link` tool accepts `custom_slug` as before. Internally chains the same way as the SDK.

**Browser client**: The admin UI create-link form chains a create call followed by an add-slug call when a custom slug is provided.

## 0.18.1 (2026-04-06)

### Settings page

- Integration card link labels are now translatable. SDK card shows "npm package: @oddbit/shrtnr", MCP card shows "MCP documentation" (or "Setup guide in README" when not configured). Translations added for Indonesian and Swedish.

### Translations

- "More actions" button aria-label on the link detail page was hardcoded; now translated.
- "auto" badge text on auto-generated slugs was hardcoded; now translated.

## 0.18.0 (2026-04-05)

### Slug charset: lowercase only

- Random slug charset narrowed from 56 characters (mixed case + digits) to 32 characters: `abcdefghijkmnpqrstuvwxyz23456789`. Removes all uppercase letters and retains the existing exclusions of `l`, `o`, `0`, `1` to avoid visual ambiguity.
- Combination counts updated throughout settings UI and client JS — now derived from `RANDOM_CHARSET.length` rather than a hardcoded number.

### Case-insensitive routing

- Incoming short links are lowercased before lookup. A link stored as `abc` is reached by `ABC`, `Abc`, or `abc`.
- Custom slugs are lowercased at write time (create and add), so what is stored is always lowercase.

### Renamed: vanity slug → custom slug

- All internal references to "vanity slug" renamed to "custom slug" across source, tests, SDK, README, and CHANGELOG.
- MCP retains backward compatibility: the `add_vanity_slug` tool alias and the `vanity_slug` parameter on `create_link` remain accepted.

### Settings page

- Version and account sections redesigned. Account now shows email and logout inline in one row. Version status and install button sit in the same row.
- MCP integration card converted to a clickable link, matching the TypeScript SDK card pattern. "Configured" badge removed; a clean doc link replaces it.

### Minimum slug length constant

- Introduced `MIN_SLUG_LENGTH` in `constants.ts`. All validation, UI, and JS now reference this constant instead of hardcoding `3`.

## 0.17.0 (2026-04-05)

### Schema and data model

- Renamed `is_custom` column to `is_custom` in the `slugs` table. All queries, types, and service calls updated to match.
- Removed the stored `click_count` column from `slugs`. Click count is now computed at query time as `link_click_count + qr_click_count`.
- Consolidated all migrations into a single `0001_initial.sql` baseline.

### QR code click tracking

- Appended `?utm_medium=qr` to URLs encoded into QR codes. The redirect handler detects this parameter and increments `qr_click_count` instead of `link_click_count`.
- Both counts combine into a single `click_count` alias returned by all queries, so existing display logic requires no changes.
- The QR dialog does not expose the UTM-tagged URL to users.

### MCP backward compatibility

- `add_custom_slug` tool kept as an alias for `add_custom_slug`.
- `create_link` accepts both `custom_slug` and `custom_slug` input fields.

### Slug display order

- In the links list, the original random slug always appears first, followed by the primary custom slug, then remaining slugs ordered by creation date.

### Settings page

- Account section moved from the sidebar footer into a dedicated card on the settings page. Displays the signed-in email and a logout button.
- Sidebar no longer shows the account/logout block.



### UI/UX Improvements

- **Redesigned Link Details header:** New layout featuring a prominent total clicks counter and a cleaner metadata grid for label, creator, and expiry information.
- **Unified Slugs management:** Merged slug management and performance statistics into a single, cohesive table view with aligned progress bars and click counts.
- **Reorganized Analytics:** Restructured the analytics layout into two columns for better space utilization, placing time-series and source data in a wider left column and other stats in a narrower right column.
- **Responsive Enhancements:** Improved layout behavior for smaller screens and mobile devices.

### Bug Fixes

- Fixed an issue where numeric 0 values were rendered as literal text in JSX.
- Fixed escaping of single quotes in the link duplication modal.

## 0.15.0

### Repository and service layer refactor

- `LinkRepository` and `SlugRepository` replace the previous flat database functions. All database access goes through these classes.
- Service functions are updated to call repository methods directly, removing the intermediate managed-service naming layer.
- `getLinkBySlug` is exposed as a standalone repository query.
- `wrangler.jsonc` replaces `wrangler.toml` as the config file format.

### Link search

- `LinkRepository.search()` queries links by label or slug substring, case-insensitive.
- `searchLinks()` service function wraps the repository call.
- `search_links` MCP tool lets AI clients find links by name, topic, or slug keyword.

## 0.14.0

### Per-user identity

Settings, API keys, and link authorship are now scoped per user identity extracted from the Cloudflare Access JWT.

- `extractIdentity()` reads claims in order: `email` → `phone` → `sub`, falling back to `"anonymous"`. Always returns a non-empty string safe for use as a database key.
- Theme, language, and slug default length are stored per user in the database. They load from the database on every admin page and fall back to the cookie, then to defaults. The cookie stays as a fast-render cache and is kept in sync.
- `setTheme()` and `setLanguage()` on the client persist the choice to the settings API, so preferences survive across browsers and devices.
- API keys are fully scoped: each user sees and can only delete their own keys.
- Links silently record `created_by` on creation (not exposed in the UI or API).
- Migration `0007_user_identity.sql` recreates the `settings` table with a `(identity, key)` composite primary key, adds an `identity` column to `api_keys`, and adds `created_by` to `links`.

### Deployment and migration documentation

- Added a prominent warning in the README that GitHub Actions workflows are not copied when Cloudflare forks a repo via the Deploy button.
- Clarified that running database migrations is mandatory: without them the schema is missing and the app will not function.
- Added step-by-step instructions for running migrations manually after each update, and for copying the workflow file into a fork to automate the process.

## 0.13.0

### CF Access auth awareness

- Admin pages (`/_/admin/*`) now validate Cloudflare Access JWTs when the `ACCESS_AUD` environment variable is set.
- Authenticated user email is shown in the sidebar with a logout link.
- `GET /_/admin/logout` clears the Access cookie and redirects to the CF Access logout endpoint.
- When `ACCESS_AUD` is not set the app falls back to trusting CF Access at the network layer (no change for existing deployments).
- No impact on slug resolution, `/_/api/*`, or `/_/mcp`.

### QR code modal

- QR button on the link detail page opens a modal with a large QR image.
- Download buttons in the modal save the code as SVG or PNG.

### Link detail page improvements

- Inline editing for label and expiry directly on the detail page.
- Responsive mobile layout: the three-column hero collapses to a stacked single-column view on narrow screens.

### PWA install

- Settings version card includes an Install App button on supported browsers.

## 0.12.0

### Link creation tracking

- Links record how they were created: `app` (admin UI), `api` (public API), `sdk` (SDK via `X-Client` header), or `mcp` (MCP tool).
- A small badge on the link detail page shows the creation source.
- SDK now sends `X-Client: sdk` on every request so the server can distinguish SDK calls from raw API calls.

### QR code download

- Admin link detail page has a download button in the QR modal that saves the code as a PNG.
- QR codes encode the short URL with a `?qr` suffix so scans are tracked separately from text link clicks.

### QR click channel analytics

- Clicks record whether they came from a QR scan or a direct text link.
- Link detail analytics show a Channels card breaking down QR vs direct clicks.
- Database defaults: existing links get `created_via = 'app'`, existing clicks get `channel = 'direct'`.

### API and SDK

- New endpoint `GET /_/api/links/:id/qr` returns an SVG QR code (optional `?slug` param).
- SDK `getLinkQR(linkId, slug?)` fetches the SVG.
- MCP `get_link_qr` tool returns a base64-encoded SVG for use in AI contexts.

## 0.11.0

### MCP

- MCP landing page and OAuth approval dialog extracted into dedicated modules with shared design tokens.
- MCP OAuth flow verified end-to-end with Claude Desktop, Claude Code, MCP Inspector, and VS Code Copilot.
- Deploy script warns when Cloudflare's "Block AI bots" rule is active, which silently drops MCP connections from AI assistants.
- README documents the required "Block AI bots" disable step as part of MCP setup.

### Admin UI

- Links page uses a hero shorten bar instead of a modal for creating links.
- API Keys page shows an SDK note with npm install instructions.
- Settings page links to release notes for the current version.

### Branding

- SVG logotype and logo assets for light and dark backgrounds, served from `/public/`.
- Admin layout and standalone pages use the theme-aware logotype.
- Removed all inlined SVG markup in favor of `<img>` references to static assets.

### Deploy

- Deploy script resolves both D1 and KV namespace IDs at deploy time. Hardcoded IDs removed from `wrangler.toml`.
- KV namespace created automatically on first deploy.
- Static assets (icons, manifest, robots.txt) moved to `public/` and served by Wrangler directly. Removed hand-rolled asset-serving code.

### Internal

- Standalone page styles split into composable `standaloneBaseStyles` and `standaloneCenteredStyles` exports.
- All dependencies updated.

## 0.10.0

### MCP endpoint moved to OAuth via Cloudflare Access (breaking)

The MCP endpoint at `/_/mcp` now uses OAuth authentication backed by Cloudflare Access for SaaS, replacing API key Bearer tokens. This enables native connectivity from claude.ai custom connectors and other OAuth-capable MCP clients.

**Breaking changes:**

- **API keys no longer accepted on `/_/mcp`.** MCP clients must authenticate through the OAuth flow. Users sign in via Cloudflare Access.
- **New infrastructure requirements.** The Worker needs a KV namespace (`OAUTH_KV`) for OAuth session state, a Durable Object for MCP sessions, and six secrets from the Cloudflare Access for SaaS application.
- **New dependency:** `@cloudflare/workers-oauth-provider` handles the OAuth 2.1 protocol.

**Unchanged:**

- API key authentication for `/_/api/*` (SDK and programmatic access) remains the same.
- Admin UI authentication remains external (Cloudflare Access policies, IP rules, etc.).

### Setup requirements

1. Create a SaaS OIDC application in Cloudflare Zero Trust.
2. Set six Worker secrets from the SaaS app: `ACCESS_CLIENT_ID`, `ACCESS_CLIENT_SECRET`, `ACCESS_TOKEN_URL`, `ACCESS_AUTHORIZATION_URL`, `ACCESS_JWKS_URL`, `COOKIE_ENCRYPTION_KEY`.
3. Deploy. The KV namespace for OAuth state is created automatically on first deploy. See the MCP section in `README.md`.

## 0.9.0

### Removed Cloudflare Access coupling (breaking)

The app no longer reads or depends on Cloudflare Access JWTs. All CF Access awareness has been stripped from the codebase. Protecting the admin UI is now the deployer's responsibility: use CF Access policies, IP restrictions, Cloudflare Tunnel, or any approach that suits your setup.

**Breaking changes:**

- **API keys are ownerless.** The `email` column is gone. All admin users manage all keys. Existing keys continue to work for authentication.
- **Preferences moved to browser cookies.** Theme and language are stored as `theme` and `lang` cookies. The `user_preferences` table is dropped. Users will need to re-select their theme after upgrading.
- **SDK `AccessTokenAuth` removed.** The SDK only supports `{ apiKey: "sk_..." }` auth. If you used `{ accessToken: "..." }`, switch to an API key.
- **`/_/admin/api/preferences` endpoints removed.** The client now writes cookies directly.
- **`Identity` type and `getIdentity()` removed** from the auth module.

### Migration notes

- Run the new `0004_remove_auth_scoping.sql` migration (applied automatically on deploy).
- Update any CF Access application path if you still want Access protection.
- No changes needed for API key authentication: existing Bearer tokens keep working.

## 0.8.0

### Admin routes moved under `/_/admin/`

All admin pages now live at `/_/admin/*` instead of `/_/*`. This separates the Cloudflare Access protection boundary from the public API path, so API keys work without Access bypass rules.

- Admin pages: `/_/admin/dashboard`, `/_/admin/links`, `/_/admin/keys`, `/_/admin/settings`
- Admin AJAX endpoints: `/_/admin/api/*` (protected by Cloudflare Access at the edge)
- Public API: `/_/api/links/*` (Bearer token only, no JWT)
- MCP: `/_/mcp` (Bearer token only, no JWT)
- Legacy redirects from old `/_/dashboard`, `/_/links`, `/_/keys`, `/_/settings` paths (301)

### Auth model split

The admin UI and public API now use separate auth paths:

- **Admin**: identity extracted from Cloudflare Access JWT via `getIdentity()`. Falls back to "anonymous" when no JWT is present, so the app works without Access configured.
- **Public API/MCP**: `resolveAuth()` checks Bearer token only. No JWT logic.
- Removed `requireAdmin` (dead code). Cloudflare Access handles admin authorization at the edge.

### Identity abstraction

Replaced `getAuthenticatedEmail()` with `getIdentity()` returning `Identity { id, displayName }`. Tries the email claim first, falls back to sub. Decouples the app from email as the sole identity mechanism.

### Cloudflare Access configuration

Update your Access application path from `_/*` to `_/admin/*`. See README for details.

## 0.7.0

### MCP endpoint refactored into the Worker

The MCP server is now a built-in remote endpoint at `/_/mcp`, served directly by the Cloudflare Worker. Every shrtnr deployment includes the MCP server out of the box, authenticated with the same API keys as the admin API.

- Added `/_/mcp` endpoint using Cloudflare's `agents` SDK with `createMcpHandler()`
- MCP tools call the service layer directly for lower latency
- Stateless per-request design: no Durable Objects required
- Consolidated the `mcp/` directory into the main application
- Simplified CI workflows to reflect the single-package structure

### Migration from `@oddbit/shrtnr-mcp`

Replace `npx @oddbit/shrtnr-mcp` with a remote MCP connection to your shrtnr deployment. See the MCP section in `README.md` for client configuration examples.

## 0.6.3

- Removed all em dashes from source files, page titles, and comments per writing rules
- Rewrote README with SEO-focused copy: clearer feature descriptions, explicit search terms, improved API table
- Language picker now shows a middle dot separator between native and localized names

## 0.6.2

- Replaced language picker toggle buttons with a dropdown select that scales to any number of languages

## 0.6.1

### Security
- Restricted link URLs to http and https schemes, rejecting javascript:, data:, file:, and ftp: targets
- Capped slug length at 128 characters to prevent oversized allocations

### Docs
- Added multi-language and API key auth to README feature list
- Clarified authentication model: Worker reads JWTs, Cloudflare Access verifies signatures
- Documented API key Bearer token usage and scope model

## 0.6.0

- Added internationalization (i18n) with English, Indonesian, and Swedish
- Language preference stored in `user_preferences` table, English as default
- Language selector on settings page shows localized and native language names
- Extracted all hardcoded UI strings into translation files
- Client-side strings translated via serialized translation object
- Locale-aware date formatting and country name display

## 0.5.0

- Migrated admin UI from monolithic SPA to Hono JSX server-rendered pages
- Replaced 1500-line template-literal file with modular page components
- Admin routes moved from `/_/admin/*` to `/_/*` with legacy redirects
- Extracted CSS and client JS into dedicated modules
- Added Hono as a dependency for routing and JSX rendering
- Updated copyright notices to 2026

## 0.4.4

- Dashboard stat cards (Total Links, Total Clicks) sit side by side on mobile instead of stacking full-width
- Wide dashboard cards (Recent Links, Most Clicked, Top Sources) span the full mobile grid
- Scaled down dashboard stat numbers for mobile screens
- Link items stay horizontal on mobile with a compact click count on the right
- URLs wrap naturally instead of being truncated

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
- Added 14 API tests: read-scope write denial, create-scope read denial, custom slug redirects, invalid JSON body handling, and 404s for nonexistent resources

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

### Custom slugs
- Limit to one custom slug per link
- Removed DELETE endpoint for custom slugs

### Theme
- Semantic on-color CSS variables (--on-primary, --on-secondary, --on-danger) for consistent contrast across all themes
- Fixed light theme: buttons, toasts, and badges now render with correct text color

### Release
- Added concurrency guard to GitHub Actions release workflow

## 0.1.0

Initial release.

- URL shortening with auto-generated and custom slugs
- Click analytics with country, referrer, device, and browser tracking
- Dashboard with top links, recent links, and country stats
- Link detail page with performance breakdown and QR code generation
- Disable/enable links via expiry timestamps
- Per-user theme switching (oddbit, dark, light)
- Settings page with slug length configuration and update checker
- Cloudflare Access authentication
- URL-based admin routing with browser history support
