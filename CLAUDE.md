# CLAUDE.md

## Coding

### Releases

When instructed to "update the version", "bump version" or "create a release":

1. Update the version in `package.json` following semver.
2. Add a section to `CHANGELOG.md` summarizing what changed. Keep it concise: a short paragraph or a few bullet points. Not a commit-by-commit log.
3. Commit the changes. But don't push to upstream.

### Testing

- Always **write tests first** for a feature or change being requested. Define behavior by writing tests first and asking the developer for details. If the behavior is trivial, write the tests directly. Then implement code that passes them.
- Always write tests for specific behaviors being requested.
- Always write tests for change requests.
- Never change tests to accommodate code changes. **Always** stop and notify the developer if a new feature breaks an existing test. You may only add new tests automatically based on requested functionality. You may not remove or modify tests when making code changes.

### Database migrations

- Migrations must preserve all existing data. D1 does not support `ALTER TABLE ... DROP CONSTRAINT` or `ADD CONSTRAINT`, so schema changes to CHECK constraints require recreating the table.
- When recreating a table that other tables reference via foreign keys with `ON DELETE CASCADE`, you must first save and drop the dependent tables, then recreate and restore them after the rename. Dropping the referenced table triggers the cascade and silently deletes all rows in dependent tables.
- Always verify that row counts in all affected tables remain unchanged after the migration.

## Repository

- Never force push git.

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
