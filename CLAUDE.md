# CLAUDE.md

## Coding

### Styling
- Never inline custom styling into components for things that are global design. Make design files and centrally declared styles that are imported by components and pages to ensure consistency and maintainability.

### Releases

Four separate release tracks, each driven by a version bump on `main`:

| Target | Manifest | Tag prefix |
|---|---|---|
| Cloudflare Workers app | root `package.json` | `app-v*` |
| TypeScript/npm SDK | `sdk/typescript/package.json` | `npm-v*` |
| Python/PyPI SDK | `sdk/python/pyproject.toml` | `py-v*` |
| Dart/pub.dev SDK | `sdk/dart/pubspec.yaml` | `pub-v*` |

Preferred entry point: `scripts/bump-sdk-version.sh <npm|python|pub> <version>`. The script edits the right manifest, adds a placeholder CHANGELOG section, and refreshes lockfiles where applicable. Replace the `TODO: fill in release notes.` line with actual notes before committing.

When instructed to "update the version", "bump version" or "create a release":

1. Update the version in the correct manifest following semver. Confirm which track if ambiguous.
2. Add a section to the corresponding `CHANGELOG.md` (root, `sdk/typescript/`, `sdk/python/`, or `sdk/dart/`) summarizing what changed. Keep it concise: a short paragraph or a few bullet points. Not a commit-by-commit log.
3. Commit the changes. But don't push to upstream.
4. **Dart/pub.dev track only:** also create the matching tag on the release commit, but do not push it:
   ```
   git tag pub-v<version>
   ```
   pub.dev publishing is triggered by the tag push, not the `main` push. The developer pushes `main` and the tag together; `release-sdk-pub.yml` fires on the tag and publishes. The app, npm, and Python tracks tag from CI after publishing, so no manual tag is needed for those.

Full details including one-time registry configuration: [docs/release-automation.md](docs/release-automation.md).

### SDKs

- **SDK parity.** When a change is made to any SDK under `sdk/`, the same change must be evaluated and applied to every other SDK in that directory. Public-method additions or renames, new models, auth changes, error-type changes, and base-URL handling all count. If a change intentionally applies to only one SDK (for example a Dart-only helper with no TypeScript analogue), state that explicitly in the commit message. Default: all SDKs move together.
- **README parity.** Each SDK's `README.md` stays in lockstep with the others. Install snippets, usage examples, auth docs, and the feature list exist in every SDK README, adjusted only for language and platform idioms (for example `await` vs `Future`, `import` vs `require`, `npm install` vs `dart pub add`). Removing or renaming a documented feature in one README requires the same edit in the others.

#### Spec hash and SDK ↔ API parity

Each SDK's package manifest records the SHA-256 of the OpenAPI spec it was last regenerated against:

| SDK | Manifest | Field |
|---|---|---|
| TypeScript | `sdk/typescript/package.json` | top-level `x-spec-hash` |
| Python | `sdk/python/pyproject.toml` | `[tool.shrtnr]` table, key `spec_hash` |
| Dart | `sdk/dart/pubspec.yaml` | top-level `x-spec-hash` |

When the OpenAPI spec changes (any edit to `src/api/router.ts`, `src/api/schemas.ts`, or any resource sub-app that affects the generated document), all three recorded hashes go stale. CI fails on stale hashes via `.github/workflows/sdk-spec-drift.yml`.

**Workflow when the API changes:**

1. Make and commit the API change. Run `./scripts/spec-hash.sh` from the repo root to get the new canonical hash.
2. For **each** SDK, decide whether the spec change requires updating SDK code:
   - **Yes** (new public endpoint, new model field, changed return shape, renamed parameter): regenerate the SDK to surface the new shape. Bump the SDK version per semver, update the SDK's `CHANGELOG.md`, then update the manifest's spec hash field.
   - **No** (internal docstring tweak, admin-only schema, server-side reorganization that does not affect the public wire format): update the manifest's spec hash field without changing SDK code. State the rationale in the commit message: "spec change does not affect SDK surface; bump hash to record review".
3. Before updating any SDK's hash, run the parity check below.
4. Commit per SDK with a focused message. Either "regenerate Python SDK against new spec (1.0.0 → 1.0.1)" or "acknowledge spec change in Python SDK; no surface change required".

**Parity check (run before bumping a hash):**

A hash bump is a declaration that the SDK is aligned with the spec at that hash. Verify before declaring:

- **Models cover spec components.** Every `components.schemas` entry in the OpenAPI document is represented by a corresponding model in the SDK (TS interface, Python dataclass, Dart class). Cross-reference `yarn emit-spec | jq '.components.schemas | keys'` against the SDK's `models.<ext>`.
- **Endpoints surface as methods.** Every public route in the spec has a method on the corresponding resource (`client.links.*`, `client.slugs.*`, `client.bundles.*`). The resource-grouped pattern is the canonical surface for all three SDKs.
- **Parameters match.** Every required and optional parameter on every method matches the spec (path params, query params like `range`, request body fields).
- **Tests pass.** Run the SDK's full test suite. New tests cover any new methods or fields introduced by the spec change.
- **Cross-SDK parity holds.** When updating one SDK against a new spec, the same surface change must be applied to the other two SDKs in the same logical PR or PR series. The spec hash advances on all three together at the end. A merged main branch with mismatched hashes across SDKs (one current, two stale) means parity work is incomplete.

The hash advances together, the SDKs ship together. A divergent hash state on `main` is a signal that someone abandoned a regeneration mid-flight; treat it as an open issue, not a steady state.

### Testing

- Always **write tests first** for a feature or change being requested. Define behavior by writing tests first and asking the developer for details. If the behavior is trivial, write the tests directly. Then implement code that passes them.
- Always write tests for specific behaviors being requested.
- Always write tests for change requests.
- Never change tests to accommodate code changes. **Always** stop and notify the developer if a new feature breaks an existing test. You may only add new tests automatically based on requested functionality. You may not remove or modify tests when making code changes.

### Internationalization

- All user-facing strings in admin pages and components must be added to the translation files and read through the `t()` translator. Never hardcode English (or any language) strings inline in JSX/TSX.
- When introducing new UI copy (buttons, labels, headings, hints, empty states, aria-labels), add the key and text to the i18n translation sources first, then reference it via `t("namespace.key")`. Applies to new features and to refactors that touch existing copy.

### Database migrations

- Migrations must preserve all existing data. D1 does not support `ALTER TABLE ... DROP CONSTRAINT` or `ADD CONSTRAINT`, so schema changes to CHECK constraints require recreating the table.
- When recreating a table that other tables reference via foreign keys with `ON DELETE CASCADE`, you must first save and drop the dependent tables, then recreate and restore them after the rename. Dropping the referenced table triggers the cascade and silently deletes all rows in dependent tables.
- Always verify that row counts in all affected tables remain unchanged after the migration.

## Repository

- Never force push git.
- Do NOT include "Co-Authored-By" notes in commit messages (e.g., "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"). Commit messages should be clean and focused on the technical rationale.
- Make logically grouped commits as you work. Each commit should capture one coherent change (one refactor, one feature, one fix) with a message that explains the rationale. Do not batch unrelated changes into a single commit, and do not wait until the end of a task to commit everything at once.

## Writing Rules

These rules apply to all produced material: docs, comments, UI copy, and any text written.

- **Specific words over general ones.** Not "move": "shuffle." Not "say": "announce." Not "problem": "bottleneck." The right word does more than the right sentence. Before settling on a word, ask: is there a more precise one?
- **No em dash.** Use a colon, comma, or period instead. Em dashes read as AI-generated filler.
- **No hollow intensifiers.** Cut "very", "really", "quite", "essentially", "basically". If the word needs a modifier to do its job, find a better word.
- **Active voice by default.** "We built X" not "X was built." Passive is allowed when the actor is unknown or irrelevant.
- **Short sentences carry more weight than long ones.** When a sentence has more than two clauses, split it.
- **No throat-clearing.** Never open with "In today's world", "As we all know", or any sentence that delays the point.

## Documentation

- Do NOT hardcode dynamic content that can drift. Never enumerate plugins, skills, dependencies, components, or any other list that has a file or folder as its source of truth. Instead, refer to that source directly. For example: `package.json` rather than listing dependencies.
