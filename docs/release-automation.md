# SDK release automation

Every SDK release track is driven by a version bump on `main`. The workflows are thin per-SDK callers on top of a reusable `.github/workflows/release-sdk.yml` that owns all the shared logic: version detection, tag-existence idempotency, changelog extraction, OIDC trusted publishing, tag creation, and GitHub release creation.

## Current tracks

| SDK | Caller workflow | Manifest | Tag prefix | Mode |
|---|---|---|---|---|
| npm (`@oddbit/shrtnr`) | `release-sdk-npm.yml` | `sdk/typescript/package.json` | `npm-v` | main-push |
| Python (`shrtnr`) | `release-sdk-python.yml` | `sdk/python/pyproject.toml` | `py-v` | main-push |
| pub.dev (`shrtnr`) | `release-sdk-pub.yml` | `sdk/dart/pubspec.yaml` | `pub-v` | tag-push |
| App (Cloudflare Workers) | `release.yml` | root `package.json` | `app-v` | main-push (standalone) |

The app track runs its own workflow because its shape differs — no build, no registry publish, just tag + GitHub release.

## How it works

**main-push mode (npm, Python).** The workflow fires on any push to `main` that touches the SDK's path. It reads the manifest's version, checks whether it changed since `HEAD~1`, and exits cleanly if not. If the version moved, it runs the SDK's setup + build + test, publishes to the registry via OIDC, then creates the `<prefix>-v<version>` tag and a matching GitHub Release. Re-running the workflow after a successful release is idempotent: the tag already exists on origin, so the workflow exits without publishing.

**tag-push mode (pub.dev).** pub.dev's trusted-publishing configuration validates the `ref` claim in the GitHub-issued OIDC token against a configured tag pattern. That means the workflow that publishes has to be triggered by a tag push. GitHub explicitly does not fire downstream workflows from tags pushed via `GITHUB_TOKEN`, so we cannot tag from one workflow and have a second workflow pick up the event — the chain breaks by design. Until the developer adds a non-`GITHUB_TOKEN` credential (deploy key or GitHub App), the pub.dev track uses a manual tag push:

```bash
scripts/bump-sdk-version.sh pub 0.2.3
# edit CHANGELOG to fill in the placeholder
git add sdk/dart/pubspec.yaml sdk/dart/CHANGELOG.md
git commit -m "Release pub 0.2.3: <summary>"
git tag pub-v0.2.3
git push origin main pub-v0.2.3
```

Pushing main + tag together hands the tag event to a user identity (not `GITHUB_TOKEN`), so `release-sdk-pub.yml` starts correctly.

## One-time registry setup

All three registries use OIDC trusted publishing — no long-lived tokens are stored anywhere. Each one needs a small configuration on the registry's web UI pointing at this repo's workflow.

### npm

Set up once per package. Under the **@oddbit** org on npmjs.com, go to the package page for `@oddbit/shrtnr` → **Settings** → **Trusted publishers**. Add:

- Publisher: GitHub Actions
- Organization/user: `oddbit`
- Repository: `shrtnr`
- Workflow: `release-sdk-npm.yml`
- Environment: _(leave blank)_

After the first successful publish, `npm publish` with `id-token: write` on the workflow will pass provenance and attestation automatically.

### PyPI

First time only: create a pending publisher before the package exists on PyPI. Go to <https://pypi.org/manage/account/publishing/> → **Add a new pending publisher**. Fill in:

- PyPI project name: `shrtnr`
- Owner: `oddbit`
- Repository name: `shrtnr`
- Workflow name: `release-sdk-python.yml`
- Environment name: _(leave blank)_

Once the first publish succeeds, the pending publisher becomes a permanent trusted publisher on the project. The workflow uses `pypa/gh-action-pypi-publish@release/v1`, which handles the OIDC handshake.

### pub.dev

Go to <https://pub.dev/packages/shrtnr/admin> → **Automated publishing**. Enable:

- Repository: `oddbit/shrtnr`
- Tag pattern: `pub-v{{version}}`
- Required environment: _(leave blank)_

That's the whole config. The workflow uses `dart-lang/setup-dart@v1`, which mints an OIDC token that pub.dev verifies against the tag pattern and the configured repo.

## Bumping a version

Use `scripts/bump-sdk-version.sh <sdk> <version>`:

```bash
scripts/bump-sdk-version.sh npm 0.7.3
scripts/bump-sdk-version.sh python 0.1.1
scripts/bump-sdk-version.sh pub 0.2.3
```

The script edits the right manifest, prepends a `## X.Y.Z` placeholder section to the matching CHANGELOG, and refreshes lockfiles where applicable. It does not commit, tag, or push — it prints a diff and the suggested next step.

Replace the `TODO: fill in release notes.` bullet with real release notes (short paragraph or a few bullets, not a commit log — match the tone of existing entries). Then open a PR. Merging to `main` fires the release workflow for npm/Python; for pub, push the matching tag alongside `main` as shown above.

## Why no release-please / changesets / semantic-release?

Because the repo intentionally keeps release tooling small. Extract + match + tag is three script steps and a version-diff check. Adding an external tool would buy less than it costs in unfamiliarity and indirection. This is consistent with how the app and SDK tracks worked before the Python SDK existed.

## Adding a future SDK

If a fourth SDK lands (say Rust, Go):

1. Add it under `sdk/<language>/` following the existing layout conventions.
2. Extend `scripts/read-version.sh` with a case for the new manifest format if it's not already JSON / YAML / TOML.
3. Extend `scripts/bump-sdk-version.sh` with a new `<sdk>` identifier.
4. Add a new caller workflow `release-sdk-<name>.yml` that delegates to `release-sdk.yml` with the right inputs.
5. Extend the reusable workflow's registry-specific publish path if the new registry isn't npm / PyPI / pub.dev.
6. Document the one-time trusted-publisher setup here.
