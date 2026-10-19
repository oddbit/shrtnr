# Security Policy

shrtnr handles bearer API keys, OAuth tokens for the MCP server, and the redirect for every short link it serves. Treat a vulnerability here as high impact, even when the reproduction looks small.

## Supported versions

Only the latest release of each track gets security fixes:

| Track | Where the fix lands |
|---|---|
| Cloudflare Workers app | latest `app-v*` |
| TypeScript/npm SDK | latest `npm-v*` |
| Python/PyPI SDK | latest `py-v*` |
| Dart/pub.dev SDK | latest `pub-v*` |
| Browser extension | latest `ext-v*` |

Older tags stay for reference. We do not backport fixes to them. Update to the latest release before reporting: the bug may already be closed.

## Reporting a vulnerability

Email **hello@oddbit.id** with the subject line `SECURITY: <short description>`. Include:

- The affected component (Worker app, a specific SDK, the browser extension, or the MCP server) and its version or commit.
- Steps to reproduce, or a proof-of-concept request/payload.
- What the flaw lets an attacker do: read another owner's links, forge a redirect, bypass the API key check, and so on.

**Do not open a public GitHub issue for a vulnerability.** The issue templates cover functional bugs and feature requests. A security report filed there is disclosed before a fix ships.

## Response window

- We acknowledge a report within **3 business days**.
- We share an initial assessment and, where possible, a fix timeline within **10 business days**.
- We credit the reporter in the fix's changelog entry, unless the reporter asks to stay anonymous.

Oddbit is a small studio, not a 24/7 security desk. Business days follow WIB (UTC+7).

## Disclosure

Hold public disclosure until a fix has shipped, or for 90 days from the report, whichever comes first. If a fix needs more time, we tell you and agree a new date with you. We do not let the 90 days lapse silently.

## Scope

| | |
|---|---|
| In scope | This repository: the Worker app under `src/`, the TypeScript, Python and Dart SDKs under `sdk/`, the browser extension under `browser-extensions/`, and the MCP server it exposes. |
| Out of scope | The underlying platforms (Cloudflare Workers, D1, npm, PyPI, pub.dev), denial-of-service testing against any live deployment, and social engineering against Oddbit staff or users. |

Report platform-level findings to the platform, not to us.

## Safe harbor

Oddbit takes no legal action against good-faith security research that stays within scope, avoids privacy violations, and does not degrade or destroy data on a live deployment. Test against your own deployment where you can: a self-hosted instance costs nothing on Cloudflare's free tier.
