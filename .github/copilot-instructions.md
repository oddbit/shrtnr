# Copilot Instructions

## Coding

### Releases

When asked to update the version, bump version, or create a release:
- Update the version in `package.json`.
- Choose the recommended version using semver based on the change scope.
- Add a summary of the change to `CHANGELOG.md`.

### Testing

Follow test-first workflow for feature and change requests:
- Write tests before implementation.
- If behavior is unclear and non-trivial, ask the developer for expected behavior before implementation.
- Always add tests for requested behavior changes.
- Never modify or remove existing tests to fit new code.
- If a requested feature breaks an existing test, stop and consult the developer before changing production code further.
- Only add new tests that cover requested functionality.

## Repository

- Never force push git.

## Writing Rules

Apply these rules to documentation, comments, UI copy, and all generated text:
- Prefer precise words over generic ones.
- Do not use em dashes. Use a colon, comma, or period.
- Avoid hollow intensifiers such as "very", "really", "quite", "essentially", and "basically".
- Use active voice by default.
- Prefer short sentences. Split sentences with more than two clauses.
- Avoid throat-clearing openings.

## Documentation

- Do not hardcode dynamic lists that can drift.
- Do not enumerate plugins, skills, dependencies, modules, or component inventories in prose when a source file or folder already defines them.
- Refer to the source of truth directly, for example `package.json`.
