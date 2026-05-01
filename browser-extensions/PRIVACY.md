# Privacy policy — shrtnr browser extension

_Last updated: 2026-05-01_

The shrtnr browser extension is open-source software published by [Oddbit](https://oddbit.id). This document describes what data the extension collects, what it transmits, and where it goes.

## What the extension collects

The extension collects two pieces of data, both provided by you on the options page:

1. The **URL of your shrtnr deployment** that you want to shorten links into.
2. An **API key** you generated from your shrtnr admin dashboard.

It also reads the **URL of the active browser tab** at the exact moment you click the toolbar icon. That URL is sent to your shrtnr deployment to be shortened, then discarded.

## Where data is sent

The extension transmits data only to the shrtnr URL you configured. Oddbit operates no shared backend for the extension. Nothing is sent to Oddbit. Nothing is sent to any third party. No analytics or telemetry SDK is bundled into the extension.

## Where data is stored

Your `baseUrl` and `apiKey` are stored in `chrome.storage.sync`, the browser's native synced settings store: readable only by this extension, encrypted at rest by the browser, and synchronised with your other browser profiles signed into the same account. The active tab URL is never stored. No browsing history or activity log is kept.

## Permissions explained

| Permission | Purpose |
|---|---|
| `activeTab` | Read the active tab URL when you click the toolbar icon, so the extension can shorten it. The extension does not read tab content. |
| `clipboardWrite` | Copy the generated short URL to your clipboard so you can paste it elsewhere. |
| `storage` | Persist your shrtnr URL and API key across browser sessions. |
| Host permission for your shrtnr URL | Granted at runtime against the exact origin you enter on the options page. The extension cannot reach any other origin. |

## What this extension does not do

- It does not collect personally identifying information, browsing history, location, or behavioural analytics.
- It does not sell or transfer data to third parties.
- It does not use or transfer data for purposes unrelated to its single purpose: shortening the active tab into your own shrtnr deployment.
- It does not execute remote code. All JavaScript is bundled at build time.

## Removing your data

Uninstalling the extension removes its `chrome.storage.sync` entry on the next sync. To erase the corresponding server-side data, use the admin dashboard on your own shrtnr deployment to delete API keys and any links you created from the extension.

## Source code

The extension is open source under the Apache 2.0 license. Every network call the extension makes is visible in the source at [github.com/oddbit/shrtnr/tree/main/browser-extensions](https://github.com/oddbit/shrtnr/tree/main/browser-extensions).

## Contact

For privacy questions or concerns, open an issue at [github.com/oddbit/shrtnr/issues](https://github.com/oddbit/shrtnr/issues), or visit [oddbit.id](https://oddbit.id) for other contact options.
