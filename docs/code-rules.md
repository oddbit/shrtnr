# Code rules

Rules that hold everywhere. Breaking one needs a better argument than convenience.

Technical only. Shape: `architecture.md`, `code-architecture.md`. Process and release: `CLAUDE.md`, `release-automation.md`. Permissions: `access-control.md`.

## Failure

**Refuse rather than guess an identity.** Outside dev mode, unset `ACCESS_AUD` shuts admin and unset `MCP_ACCESS_AUD` shuts MCP. A header, cookie or unsigned token is never an identity.

**Redirects outlive operator failures.** A failed migration on an existing schema keeps `/:slug` serving; only operator routes answer 503.

**Side work never fails a completed request.** Click recording and auto-labelling run in `waitUntil`, after the response. The widget cache bump swallows its own error.

**JSON callers get JSON errors.** A route group answering JSON declares `answersJson` where it is mounted. Everyone else gets plain text.

**Invalid config falls back to the safe default, never to a wrong one.** A malformed `SHORT_ORIGIN` is ignored in favor of the request origin.

## Authorization

**One service layer decides.** Admin API, public API and MCP call the same service; ownership checks live there and nowhere else.

**Scope first, then ownership.** A `read` key is refused on writes before ownership is read.

**A clicked link or slug is disabled, never deleted.** Delete is refused server-side after the first click.

**The rules in `CLAUDE.md` ("Authorization model") are settled.** Tests in `authorization-model.test.ts`, `authorization-surfaces.test.ts` and `e2e/authorization.spec.ts` pin them.

## Data

**D1 is the truth; KV is a cache of it.** Every service call that changes a slug's target, state or existence writes or deletes its KV entry in the same call.

**SQL lives in repositories.** Services and surfaces never write SQL.

**Click counts share one filter.** Bot and self-referrer exclusion comes from `clickFilterSql`; no query spells it again.

**Interpolated SQL identifiers come from a whitelist.** Breakdown dimensions map through a fixed table.

**A statement binds at most `D1_MAX_BOUND_PARAMS`.** Page sizes are capped to fit.

**An applied migration is never edited.** Add a new one, run `yarn migrations:bundle`, commit both. D1 table recreation preserves data and dependent rows (`CLAUDE.md`, "Database migrations").

**Slugs are stored and matched lowercase, and never start with `_`.** `_` is the reserved operator namespace.

## Workers runtime

**No I/O shared across requests.** Share data, not in-flight promises (`src/access.ts`, JWKS cache).

**Anything after the response goes through `waitUntil`.**

**Outbound fetches to user URLs pass the SSRF guard** (`src/title-fetch.ts`): http(s), public host only.

**Bindings are generated, never hand-typed.** `yarn types` after any `wrangler.jsonc` change.

## Caching

**Redirects:** 301 with `private, max-age=90`, so disables and retargets reach returning visitors.

**Admin HTML:** `private, no-cache, must-revalidate`.

**CSS and client script:** content-hashed URL, immutable. Unknown hash answers current content with `no-store`.

**Vendor files and fonts:** version in the file name, immutable (`public/_headers`).

**Widget fragments:** keyed by identity, language, filters, range, entity and a KV version token. A successful admin API write bumps the token.

## API and SDKs

**The OpenAPI document is generated from the zod routes.** No hand-written spec.

**A spec change stales all three SDK hashes.** So does a root version bump. Update in the same commit (`CLAUDE.md`, "Spec hash").

**SDKs move together.** Methods, models, errors, auth, README.

**Link responses carry `short_origin`.** Clients never derive it from the API host.

## Interface

**Every user-visible string is a `t()` key.** Server pages and `client.ts` alike. Every language table carries every key; the type fails otherwise.

**Every style lives in `src/styles.ts`.** No inline styles for global design.

**Pages render their data on first load.** Widgets are the exception: lazy, cached, swapped by htmx.

**The URL holds what a reload must keep:** range, filter, sort, page, search.

**Escape every interpolation into raw HTML** with `escHtml`.

## Tests are the specification

- **Two suites.** `yarn test`: server HTML, JSON, SQL. `yarn e2e`: the page responds when clicked.
- **Admin UI changes end with `yarn e2e` green.** Paths: `src/pages/`, `src/admin/`, `src/client.ts`, `src/styles.ts`, admin routes in `src/index.tsx`.
- **The suite is hermetic.** Vitest stubs every outbound fetch (`vitest.config.mts`); e2e runs on a throwaway D1.
- **Page weight and accessibility are budgets.** `e2e/perf.spec.ts` fails on bytes and DOM invariants; timing is printed only.
- **Tests are hardened, never weakened.** A change that breaks a test is wrong until shown otherwise (`CLAUDE.md`, "Testing").
