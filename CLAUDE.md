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
