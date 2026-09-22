# Contributing to shrtnr

shrtnr is a Cloudflare Workers URL shortener with TypeScript, Python, and Dart SDKs, a browser extension, and an MCP server, all in this one repository. This guide covers what a pull request needs to merge.

For anything beyond a small fix, open an issue first. It saves you from building something that duplicates work in progress or conflicts with the project's direction.

Found a security vulnerability instead of a bug? Do not open an issue. See [SECURITY.md](SECURITY.md).

## Setup

```bash
yarn install
yarn types                       # binding and runtime types from wrangler.jsonc, git-ignored
cp .dev.vars.example .dev.vars   # local identity settings, git-ignored
yarn test
yarn dev
```

The [README](README.md#development) covers local sign-in and the rest of the development workflow in more detail. SDK development lives under `sdk/<language>/`; each has its own `yarn install` / `yarn test` / `yarn build` (or `pytest`, `dart test`) inside that directory.

## Where things live

| Area | Path |
|---|---|
| Worker app (routes, admin UI, API) | `src/` |
| Vitest suite (server: HTML, JSON, SQL) | `src/__tests__/` |
| Playwright suite (browser: admin pages) | `e2e/` |
| TypeScript SDK | `sdk/typescript/` |
| Python SDK | `sdk/python/` |
| Dart SDK | `sdk/dart/` |
| Browser extension | `browser-extensions/` |
| CI workflows | `.github/workflows/` |

## Tests

Write tests for the behavior you add or change, and implement to make them pass. Never edit or delete an existing test to make your change fit. If your change breaks one, that's a sign the change needs discussion, not that the test needs to go: open the PR with the failure visible and explain the conflict, and we'll work it out together.

Two suites answer different questions:

- **`yarn test`** (Vitest, `src/__tests__/`): does the server emit the right HTML, JSON, and SQL?
- **`yarn e2e`** (Playwright, `e2e/`): does the page in front of a user respond when clicked? It boots `wrangler dev` against a throwaway D1, signs in through `/_/dev/login`, seeds a catalog, and drives every admin page in Chromium.

Any change under `src/pages/`, `src/admin/`, `src/client.ts`, `src/styles.ts`, or the admin routes in `src/index.tsx` needs a green `yarn e2e` run, not just `yarn test`. Rendering assertions can't see a dead button, a script that throws on load, or a link that 500s under real data. The browser can. A new admin control (chip, sort, paginator, selector, row action) needs an e2e step that clicks it and checks the resulting URL and marked state, alongside its render assertions.

If your change adds a font, a script, or a third-party stylesheet, run `yarn perf` and paste its byte-weight table into the PR description. `e2e/perf.spec.ts` also runs inside `yarn e2e` and fails the build on byte-budget or accessibility regressions.

## UI copy

Every user-facing string in an admin page or component goes through `t()` and lives in a translation file. No hardcoded strings in JSX/TSX, including for new features or when refactoring existing copy. Add the key and text to the i18n source before you reference it.

## Styling

No inline styles for anything that affects global design. Centralized style files, imported by the components and pages that use them.

## SDKs

The three SDKs are meant to move together. A change to one (a new method, model, auth flow, error type, or base-URL behavior) should be evaluated for the other two in the same pull request series. If you're only touching one on purpose, say why in the commit message. The same rule applies to each SDK's `README.md`: keep them in lockstep, adjusted only for language idioms.

If your change touches `src/api/router.ts`, `src/api/schemas.ts`, or a resource sub-app that affects the generated OpenAPI document, see [docs/release-automation.md](docs/release-automation.md) for the spec-hash mechanic that keeps the SDKs and the API in sync. CI's `sdk-spec-drift` check will fail the build otherwise.

## Commits and pull requests

Group commits logically as you go: one refactor, one feature, or one fix per commit, with the reasoning in the message. Don't batch unrelated changes into one commit, and don't defer everything to the end of the branch.

In the PR description, say what changed, why, and how you tested it (which suites you ran, and the `yarn perf` table if it applies). Small, reviewable PRs move faster than large ones.

## License

shrtnr is Apache 2.0 licensed (see [LICENSE](LICENSE)). By submitting a pull request, you agree your contribution is licensed under the same terms.

## Conduct

Disagree about the technical approach as much as you like. Keep it about the code, not the person who wrote it.
