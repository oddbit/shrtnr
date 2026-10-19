# SDK release automation

A version bump on `main` drives every release track. Each track has one self-contained workflow under `.github/workflows/` holding version detection, tag-existence idempotency, OIDC trusted publishing and tag creation.

**No reusable workflow.** The OIDC claims behind npm provenance, PyPI trusted publishing and pub.dev publishing all diverge when a reusable is in play. The shared logic is small, so duplication costs less than the indirection.

## Current tracks

| SDK | Workflow | Manifest | Tag prefix | Mode |
|---|---|---|---|---|
| npm (`@oddbit/shrtnr`) | `release-sdk-npm.yml` | `sdk/typescript/package.json` | `npm-v` | main-push |
| Python (`shrtnr`) | `release-sdk-python.yml` | `sdk/python/pyproject.toml` | `py-v` | main-push |
| pub.dev (`shrtnr`) | `release-sdk-pub.yml` | `sdk/dart/pubspec.yaml` | `pub-v` | tag-push |
| App (Cloudflare Workers) | `release.yml` | root `package.json` | `app-v` | main-push |

`release-extension.yml` also exists for the browser extension, but it has never completed a release. The repo has no Chrome Web Store or AMO secrets, so every run stops at the store upload and no `ext-v` tag exists. Ship the extension through the store dashboards until those secrets are configured.

The workflows share helper scripts under `scripts/`. Each workflow names the helpers it calls.

## How it works

**main-push mode (npm, Python).** The workflow fires on any push to `main` that touches the SDK's path.

1. Compare the manifest across the push range (`github.event.before..github.sha`). Exit cleanly if it did not change. A multi-commit push still detects a bump that is not the last commit.
2. Run the SDK's setup, build and test.
3. Publish to the registry via OIDC.
4. Create and push the `<prefix>-v<version>` tag. No GitHub Release.

Idempotency has two layers: the push-range check, plus a tag-exists check that catches reruns of a successful release.

**tag-push mode (pub.dev).** pub.dev's trusted publishing validates the `ref` claim in the GitHub-issued OIDC token against a configured tag pattern, so a tag push must trigger the publishing workflow. GitHub does not fire downstream workflows from tags pushed via `GITHUB_TOKEN`. One workflow cannot tag and hand the event to a second: the chain breaks by design. Until the developer adds a non-`GITHUB_TOKEN` credential (deploy key or GitHub App), push the tag by hand:

```bash
scripts/bump-sdk-version.sh pub 0.2.3
# edit CHANGELOG to fill in the placeholder
git add sdk/dart/pubspec.yaml sdk/dart/CHANGELOG.md
git commit -m "Release pub 0.2.3: <summary>"
git tag pub-v0.2.3
git push origin main pub-v0.2.3
```

Pushing `main` and the tag together hands the tag event to a user identity (not `GITHUB_TOKEN`), so `release-sdk-pub.yml` starts.

## GitHub Releases

**Only the app track creates a GitHub Release.** `release.yml` guards the tag prefix (`app-v<semver>`) before tagging and fails the job on anything else. It passes `--latest` to `gh release create`, so the sidebar always shows the app version.

**SDK and extension workflows only push a tag.** Their release notes live in the matching `CHANGELOG.md` and on the registry page (npm, PyPI, pub.dev), so an SDK version never appears in the repo sidebar.

`scripts/prune-sdk-releases.sh` cleans up releases created before this rule. It lists every release under an SDK prefix. With `--apply`, it deletes each one or marks it non-latest. It never deletes a tag, so published versions stay resolvable.

## One-time registry setup

All three SDK registries use OIDC trusted publishing, so no long-lived token is stored anywhere. Each registry needs one configuration in its web UI pointing at this repo's workflow.

### npm

Set up once per package. Under the **@oddbit** org on npmjs.com, go to the package page for `@oddbit/shrtnr` → **Settings** → **Trusted publishers**. Add:

- Publisher: GitHub Actions
- Organization/user: `oddbit`
- Repository: `shrtnr`
- Workflow: `release-sdk-npm.yml`
- Environment: _(leave blank)_

After the first successful publish, `npm publish` with `id-token: write` on the workflow passes provenance and attestation automatically.

### PyPI

First time only: create a pending publisher before the package exists on PyPI. Go to <https://pypi.org/manage/account/publishing/> → **Add a new pending publisher**. Fill in:

- PyPI project name: `shrtnr`
- Owner: `oddbit`
- Repository name: `shrtnr`
- Workflow name: `release-sdk-python.yml`
- Environment name: _(leave blank)_

After the first successful publish, the pending publisher becomes a permanent trusted publisher on the project. The workflow uses `pypa/gh-action-pypi-publish@release/v1`, which handles the OIDC handshake.

### pub.dev

Go to <https://pub.dev/packages/shrtnr/admin> → **Automated publishing**. Enable:

- Repository: `oddbit/shrtnr`
- Tag pattern: `pub-v{{version}}`
- Required environment: _(leave blank)_

No other configuration. The workflow uses `dart-lang/setup-dart@v1`, which mints an OIDC token that pub.dev verifies against the tag pattern and the configured repo.

## Bumping a version

Run `scripts/bump-sdk-version.sh <sdk> <version>`:

```bash
scripts/bump-sdk-version.sh npm 0.7.3
scripts/bump-sdk-version.sh python 0.1.1
scripts/bump-sdk-version.sh pub 0.2.3
```

The script edits the right manifest, prepends a `## X.Y.Z` placeholder section to the matching CHANGELOG, and refreshes lockfiles where applicable. It prints a diff and the suggested next step. It does not commit, tag or push.

1. Replace the `TODO: fill in release notes.` bullet with real notes: a short paragraph or a few bullets, not a commit log, in the tone of existing entries.
2. Commit the bump on `main`, without a PR.
3. npm and Python: the push to `main` fires the release workflow. pub: push the matching tag alongside `main`, as shown above.

## Why no release-please, changesets or semantic-release

**Release tooling stays small on purpose.** Extract, match and tag is three script steps and a version-diff check. An external tool buys less than it costs in unfamiliarity and indirection. The app and SDK tracks worked this way before the Python SDK existed.

## Adding a future SDK

For a fourth SDK (say Rust, Go):

1. Add it under `sdk/<language>/` following the existing layout conventions.
2. Extend `scripts/read-version.sh` with a case for the new manifest format if it is not JSON, YAML or TOML.
3. Extend `scripts/bump-sdk-version.sh` with a new `<sdk>` identifier.
4. Add a workflow `release-sdk-<name>.yml`. Copy the closest track (main-push from npm/Python, tag-push from pub.dev) and swap the manifest path, tag prefix and publish steps.
5. Document the one-time trusted-publisher setup here.
