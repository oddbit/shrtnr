# CLAUDE.md

Shape: `docs/architecture.md`, `docs/code-architecture.md`. Technical rules: `docs/code-rules.md`.

## Styling

- No inline styles for global design. Styles live in centralized files that components and pages import.

## Releases

A version bump on `main` drives each track:

| Target | Manifest | Tag prefix |
|---|---|---|
| Cloudflare Workers app | root `package.json` | `app-v*` |
| TypeScript/npm SDK | `sdk/typescript/package.json` | `npm-v*` |
| Python/PyPI SDK | `sdk/python/pyproject.toml` | `py-v*` |
| Dart/pub.dev SDK | `sdk/dart/pubspec.yaml` | `pub-v*` |

SDK bumps: `scripts/bump-sdk-version.sh <npm|python|pub> <version>` edits the manifest, adds a placeholder CHANGELOG entry and refreshes lockfiles. Replace `TODO: fill in release notes.` before committing.

On "update the version", "bump version" or "create a release":

1. Bump the manifest per semver. Confirm the track if ambiguous.
2. Add a concise section (paragraph or bullets, not a commit log) to the `CHANGELOG.md` next to the manifest.
3. App track only: the spec embeds `info.version`, so the bump stales all three SDK hashes. Run `./scripts/spec-hash.sh` and update every hash field (see Spec hash) in the same commit, or CI's `sdk-spec-drift` fails.
4. Commit. Do not push.
5. Dart only: tag locally, do not push: `git tag pub-v<version>`. pub.dev publishes on tag push. CI tags app, npm and Python after publish.

**Only the app track creates a GitHub Release** (with `--latest`). SDK and extension workflows tag and publish to their registry; never add `gh release create` to them.

Details: [docs/release-automation.md](docs/release-automation.md).

## SDKs

- **SDK parity.** A change to one SDK under `sdk/` applies to the others: public methods, models, auth, errors, base-URL handling. A single-SDK change states its reason in the commit message.
- **README parity.** SDK READMEs stay in lockstep (install, usage, auth, feature list), differing only for language idioms. Removing or renaming a documented feature in one means the same edit in the others.

### Spec hash

Each SDK records the SHA-256 of the OpenAPI spec it was last regenerated against:

| SDK | Manifest | Field |
|---|---|---|
| TypeScript | `sdk/typescript/package.json` | top-level `x-spec-hash` |
| Python | `sdk/python/pyproject.toml` | `[tool.shrtnr]` `spec_hash` |
| Dart | `sdk/dart/pubspec.yaml` | leading comment `# x-spec-hash:` (a top-level key draws a pana warning) |

Stales all three: edits to `src/api/router.ts`, `src/api/schemas.ts` or a resource sub-app that change the generated doc, and any root `package.json` version bump. CI enforces it in the `sdk-spec-drift` job (`.github/workflows/ci.yml`).

On API change:

1. Commit the API change. Run `./scripts/spec-hash.sh` for the new hash.
2. Per SDK:
   - **Surface change** (new endpoint or field, changed return shape, renamed param): regenerate, semver bump, `CHANGELOG.md`, hash.
   - **No surface change** (internal docstring, admin-only schema, server-side reorg): hash only, message "spec change does not affect SDK surface; bump hash to record review".
3. Run the parity check before bumping any hash.
4. One focused commit per SDK.

### Parity check (before any hash bump)

- **Models** cover every `components.schemas` entry: diff `yarn emit-spec | jq '.components.schemas | keys'` against each SDK's `models.<ext>`.
- **Endpoints** surface as methods on the resource groups in each SDK's `resources/` directory (`client.links.*` and its siblings).
- **Parameters** match the spec: path, query (e.g. `range`), request body.
- **Tests pass:** the full SDK suite. New methods and fields get new tests.
- **Cross-SDK parity holds.** Surface changes land in all three SDKs in the same PR series, and the hash advances on all three together. Mismatched hashes on `main` are an open issue, not a steady state.

## Authorization model

Settled. Do not raise these for confirmation, flag them as gaps or add gates.

1. Anyone can create a link.
2. Anyone can see everyone's links, bundles and analytics, including `GET /_/api/links?owner=`.
3. Anyone can add a custom slug to anyone's link.
4. The owner can delete a link or a custom slug while it has zero clicks.
5. Once a link or slug has clicks, the owner disables it instead. The admin UI offers exactly one of the two, chosen by click count. Delete is refused server-side after the first click.
6. The link owner owns its slugs: set primary, disable, enable, remove.
7. The bundle owner updates, archives and deletes the bundle, and removes links from it.
8. Anyone can contribute links to any bundle. The link page's "Add to bundle" is the entry point; the bundle page's "Add link" is the owner's shortcut.

The system-generated slug is never removed or disabled on its own; disable the whole link.

**The UI's behavior is the source of truth.** When code, docs, tests or comments disagree, what the admin UI has offered users (or was clearly built to offer) wins. Never derive rules from the database schema or from what a column permits. `src/__tests__/service/authorization-model.test.ts` and `src/__tests__/handler/authorization-surfaces.test.ts` pin the rules: a failure there after a change means the change is wrong, not the test.

Details: [docs/access-control.md](docs/access-control.md).

## Testing

- **Tests are the requirements and the functional documentation.** Write a behavior rule down as a test instead of asking the developer. UI/UX rules (which control a visitor is offered, what a click does) go in Playwright under `e2e/`; server answers go in vitest. The model is `e2e/authorization.spec.ts`: the eight authorization rules, each as a browser step.
- **Tests first.** Ask the developer for behavior details; write trivial ones directly. Implement to pass. Every requested behavior or change gets tests.
- **Harden, never weaken.** Never modify or remove a test to make a change pass: no loosened assertions, deleted cases, widened tolerances, skips or retries. If a change breaks a test, stop and notify the developer.
- **Hardening needs no permission:** fixing a defect in the test (race, missing wait, wrong fixture), making it deterministic, or tightening an assertion. It keeps every assertion's intent, and the commit message names the defect and why the test, not the code, was wrong.
- **Two suites.** `yarn test` (vitest, `src/__tests__/`): does the server emit the right HTML, JSON and SQL. `yarn e2e` (Playwright, `e2e/`): does the page respond when clicked. It boots `wrangler dev` on a throwaway D1, signs in through `/_/dev/login`, seeds a catalog and drives every admin page in Chromium.
- **Admin UI changes end with `yarn e2e` green**, not only `yarn test`: any change under `src/pages/`, `src/admin/`, `src/client.ts`, `src/styles.ts` or the admin routes in `src/index.tsx`. A review or release touching those paths is incomplete until e2e has run. Render tests miss dead controls, scripts that throw on load and links that 500 under real data.
- **New admin controls** (chip, sort, paginator, selector, row action) get an e2e step that clicks them and asserts the URL and marked state, alongside the vitest render assertions.
- **`e2e/perf.spec.ts`** runs in `yarn e2e`. It pins page weight (cold-load wire bytes, largest response), layout shift and DOM accessibility invariants (hidden icon glyphs, one `h1`, labelled controls, named buttons). Byte budgets and DOM checks fail the run; timing is printed, never asserted. `yarn perf` runs it alone under Fast 3G / 4x CPU. A change adding a font, script or third-party stylesheet ends with `yarn perf` and its table in the PR description.

## Internationalization

- Every user-facing string in admin pages and components goes through `t()` and lives in translation files. No hardcoded strings in JSX/TSX.
- New or refactored UI copy (buttons, labels, headings, hints, empty states, aria-labels): add the key and text to the i18n sources first, then reference `t("namespace.key")`.

## Database migrations

- Preserve all data. D1 has no `ALTER TABLE ... DROP/ADD CONSTRAINT`; a CHECK change requires table recreation.
- Recreating a table that FKs reference with `ON DELETE CASCADE`: save and drop the dependent tables first, restore them after the rename. Dropping the referenced table cascades and silently deletes dependent rows.
- Verify row counts in every affected table after migrating.

## Worker configuration

- **Binding and runtime types are generated.** `yarn types` writes the git-ignored `worker-configuration.d.ts` from `wrangler.jsonc`; CI runs it before the typecheck. Rerun it after any `wrangler.jsonc` change. Secrets and dev-only vars are declared in `src/types.ts`, merged into `Cloudflare.Env`.
- **`compatibility_date` is capped** by the older bundled `workerd` (wrangler and the vitest pool). `yarn test` names the newest supported date when the value is too new. Review the flags between the old and new date before advancing it.

## Repository

- Never force push.
- No "Co-Authored-By" lines in commit messages.
- Commit as work progresses: one coherent change per commit (refactor, feature or fix) with the rationale in the message. Do not batch unrelated changes or defer all commits to the end.

## Writing rules

For all produced text (docs, comments, UI copy):

- Specific words over general ones: "shuffle" over "move", "announce" over "say", "bottleneck" over "problem".
- No em dashes. Use a colon, comma or period.
- No hollow intensifiers ("very", "really", "quite", "essentially", "basically"). Pick a better word instead.
- Active voice. Passive only when the actor is unknown or irrelevant.
- Split sentences with more than two clauses.
- No throat-clearing openers ("In today's world", "As we all know").

## Documentation

- **Concise and instructional.** Match `docs/architecture.md`, `docs/code-architecture.md` and `docs/code-rules.md`: tables for mappings, bold one-line rules with a short reason, imperative steps. Cut filler; keep every fact.
- **No drifting content.** Never enumerate plugins, skills, dependencies, components or any list backed by a file or folder. Reference the source (e.g. `package.json`, not a dependency list).
