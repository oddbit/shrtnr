# CLAUDE.md

## Styling

- No inline styles for global design. Use centralized style files imported by components/pages.

## Releases

Release tracks (version bump on `main` drives each):

| Target | Manifest | Tag prefix |
|---|---|---|
| Cloudflare Workers app | root `package.json` | `app-v*` |
| TypeScript/npm SDK | `sdk/typescript/package.json` | `npm-v*` |
| Python/PyPI SDK | `sdk/python/pyproject.toml` | `py-v*` |
| Dart/pub.dev SDK | `sdk/dart/pubspec.yaml` | `pub-v*` |

Use `scripts/bump-sdk-version.sh <npm|python|pub> <version>` to bump SDK versions. It edits the manifest, adds a placeholder CHANGELOG entry, and refreshes lockfiles. Replace `TODO: fill in release notes.` before commit.

On "update the version" / "bump version" / "create a release":

1. Bump version in the correct manifest per semver. Confirm track if ambiguous.
2. Add a concise section (paragraph or bullets, not a commit log) to the matching `CHANGELOG.md` (root, `sdk/typescript/`, `sdk/python/`, `sdk/dart/`).
3. App track only: the OpenAPI spec embeds `info.version` from root `package.json`, so every app version bump stales all three SDK hashes. Before committing, run `./scripts/spec-hash.sh` and update `x-spec-hash` in `sdk/typescript/package.json`, `spec_hash` in `sdk/python/pyproject.toml`, and the `# x-spec-hash:` comment in `sdk/dart/pubspec.yaml` in the same commit. CI's `sdk-spec-drift` gate fails otherwise.
4. Commit. Do not push.
5. Dart only: also create the tag locally, do not push: `git tag pub-v<version>`. pub.dev publishes on tag push. App/npm/Python tag from CI after publish.

Full details: [docs/release-automation.md](docs/release-automation.md).

## SDKs

- **SDK parity.** Any change to one SDK under `sdk/` must be evaluated and applied to the others (public methods, models, auth, errors, base-URL handling). Single-SDK changes require explicit rationale in the commit message. Default: SDKs move together.
- **README parity.** All SDK READMEs stay in lockstep (install, usage, auth, feature list), adjusted only for language idioms. Removing/renaming a documented feature in one requires the same edit in the others.

### Spec hash

Each SDK records the SHA-256 of the OpenAPI spec it was last regenerated against:

| SDK | Manifest | Field |
|---|---|---|
| TypeScript | `sdk/typescript/package.json` | top-level `x-spec-hash` |
| Python | `sdk/python/pyproject.toml` | `[tool.shrtnr]` `spec_hash` |
| Dart | `sdk/dart/pubspec.yaml` | leading comment `# x-spec-hash:` (top-level keys would draw a pana warning) |

Spec changes (edits to `src/api/router.ts`, `src/api/schemas.ts`, or any resource sub-app affecting the generated doc) stale all three hashes. A root `package.json` version bump also drifts the hash because the spec embeds `info.version`. CI enforces via the `sdk-spec-drift` job in `.github/workflows/ci.yml`.

Workflow on API change:

1. Commit the API change. Run `./scripts/spec-hash.sh` for the new hash.
2. For each SDK, decide:
   - **Surface change** (new endpoint, new field, changed return shape, renamed param): regenerate SDK, semver bump, update `CHANGELOG.md`, update hash field.
   - **No surface change** (internal docstring, admin-only schema, server-side reorg): update hash only. Commit message: "spec change does not affect SDK surface; bump hash to record review".
3. Run parity check before bumping any hash.
4. Commit per SDK with focused message.

### Parity check (required before hash bump)

- **Models** cover every `components.schemas` entry. Diff `yarn emit-spec | jq '.components.schemas | keys'` against SDK `models.<ext>`.
- **Endpoints** surface as methods on resource groups (`client.links.*`, `client.slugs.*`, `client.bundles.*`).
- **Parameters** match spec (path, query like `range`, request body).
- **Tests pass.** Full SDK test suite. New methods/fields require new tests.
- **Cross-SDK parity holds.** Surface changes apply to all three SDKs in the same PR series. Hash advances on all three together. Mismatched hashes on `main` = open issue, not steady state.

## Testing

- Write tests first. Ask the developer for behavior details; if trivial, write directly. Implement to pass.
- Write tests for every requested behavior or change.
- Never modify or remove tests to accommodate code changes. If a new feature breaks an existing test, stop and notify the developer. Only adding new tests is permitted.
- Two suites, two questions. `yarn test` (vitest, `src/__tests__/`) asks whether the server emits the right HTML, JSON and SQL. `yarn e2e` (Playwright, `e2e/`) asks whether the page in front of the user responds when clicked: it boots `wrangler dev` on a throwaway D1, signs in through `/_/dev/login`, seeds a catalog, and drives every admin page in Chromium.
- Any change under `src/pages/`, `src/admin/`, `src/client.ts`, `src/styles.ts` or `src/index.tsx` admin routes ends with `yarn e2e` green, not only `yarn test`. A code review or release that touches those paths is not complete until the e2e suite has run. Rendering tests cannot see a dead control, a script that throws on load, or a link that 500s under real data; the browser can.
- New admin controls (chip, sort, paginator, selector, row action) get an e2e step that clicks them and asserts the URL and the marked state, alongside the vitest render assertions.

## Internationalization

- All user-facing strings in admin pages/components go through `t()` and live in translation files. No inline hardcoded strings in JSX/TSX.
- New UI copy (buttons, labels, headings, hints, empty states, aria-labels): add key+text to i18n sources first, then reference via `t("namespace.key")`. Applies to new features and refactors of existing copy.

## Database migrations

- Preserve all existing data. D1 has no `ALTER TABLE ... DROP/ADD CONSTRAINT`; CHECK constraint changes require table recreation.
- When recreating a table referenced by FKs with `ON DELETE CASCADE`: save and drop dependent tables first, then restore after rename. Dropping the referenced table cascades and silently deletes dependent rows.
- Verify row counts unchanged in all affected tables post-migration.

## Repository

- Never force push.
- No "Co-Authored-By" lines in commit messages.
- Logically grouped commits as work progresses. One coherent change per commit (one refactor, one feature, one fix) with rationale in the message. Do not batch unrelated changes; do not defer all commits to task end.

## Writing rules

Apply to all produced material (docs, comments, UI copy, any text):

- Prefer specific words over general ones. "shuffle" over "move", "announce" over "say", "bottleneck" over "problem".
- No em dashes. Use colon, comma, or period.
- No hollow intensifiers ("very", "really", "quite", "essentially", "basically"). If a word needs a modifier, pick a better word.
- Active voice by default. Passive only when actor is unknown or irrelevant.
- Split sentences with more than two clauses.
- No throat-clearing openers ("In today's world", "As we all know").

## Documentation

- Do not hardcode dynamic content that can drift. Never enumerate plugins, skills, dependencies, components, or any list backed by a file/folder source of truth. Reference the source directly (e.g. `package.json` over a dependency list).
