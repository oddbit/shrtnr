# Contributing to shrtnr

One repository holds the Cloudflare Workers URL shortener, its TypeScript, Python and Dart SDKs, a browser extension and an MCP server. This guide covers what a pull request needs to merge.

**Open an issue before anything beyond a small fix.** It catches duplicate work in progress and conflicts with the project's direction before you build.

**Report security vulnerabilities privately, not as issues.** See [SECURITY.md](SECURITY.md).

## Setup

```bash
yarn install
yarn types                       # binding and runtime types from wrangler.jsonc, git-ignored
cp .dev.vars.example .dev.vars   # local identity settings, git-ignored
yarn test
yarn dev
```

The [README](README.md#development) covers local sign-in and the rest of the development workflow. Each SDK under `sdk/<language>/` has its own `yarn install` / `yarn test` / `yarn build` (or `pytest`, `dart test`), run inside that directory.

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

**Write tests for the behavior you add or change, then implement to pass them.**

**Never edit or delete an existing test to make your change fit.** A broken test signals that the change needs discussion. Open the PR with the failure visible, explain the conflict, and we work it out together.

| Suite | Path | Question |
|---|---|---|
| `yarn test` (Vitest) | `src/__tests__/` | Does the server emit the right HTML, JSON and SQL? |
| `yarn e2e` (Playwright) | `e2e/` | Does the page in front of a user respond when clicked? |

`yarn e2e` boots `wrangler dev` against a throwaway D1, signs in through `/_/dev/login`, seeds a catalog, and drives every admin page in Chromium.

**Admin changes need a green `yarn e2e`, not only `yarn test`.** This covers any change under `src/pages/`, `src/admin/`, `src/client.ts`, `src/styles.ts`, or the admin routes in `src/index.tsx`. Rendering assertions cannot see a dead button, a script that throws on load, or a link that 500s under real data. The browser can.

**A new admin control gets an e2e step.** For a chip, sort, paginator, selector or row action, the step clicks it and checks the resulting URL and marked state, alongside its render assertions.

**A new font, script or third-party stylesheet needs `yarn perf`.** Paste its byte-weight table into the PR description. `e2e/perf.spec.ts` also runs inside `yarn e2e` and fails the build on byte-budget or accessibility regressions.

## UI copy

**Every user-facing string in an admin page or component goes through `t()`.** It lives in a translation file. No hardcoded strings in JSX/TSX, in new features or in refactors of existing copy. Add the key and text to the i18n source before you reference it.

## Styling

**No inline styles for global design.** Put them in centralized style files, imported by the components and pages that use them.

## SDKs

**The three SDKs move together.** Evaluate a change to one (a new method, model, auth flow, error type or base-URL behavior) for the other two in the same pull request series. If you touch only one on purpose, say why in the commit message.

**SDK READMEs stay in lockstep**, adjusted only for language idioms.

**API changes move the spec hash.** A change to `src/api/router.ts`, `src/api/schemas.ts`, or a resource sub-app that affects the generated OpenAPI document stales the SDK hashes, and CI's `sdk-spec-drift` check fails the build. [docs/release-automation.md](docs/release-automation.md) describes the mechanic.

## Commits and pull requests

**One coherent change per commit:** one refactor, one feature or one fix, with the reasoning in the message. Commit as you go. Do not batch unrelated changes or defer everything to the end of the branch.

**The PR description says what changed, why, and how you tested it:** which suites you ran, plus the `yarn perf` table if it applies. Small, reviewable PRs move faster than large ones.

## License

shrtnr is Apache 2.0 licensed (see [LICENSE](LICENSE)). By submitting a pull request, you agree your contribution is licensed under the same terms.

## Conduct

Disagree about the technical approach as much as you like. Keep it about the code, not the person who wrote it.
