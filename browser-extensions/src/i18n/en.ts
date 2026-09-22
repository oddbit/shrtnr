// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

const en = {
  "_lang": "en",

  // Brand
  "brand.name": "shrtnr",
  "brand.tagline": "Self-hosted URL shortener",

  // Popup: generic
  "popup.loading": "Shortening...",
  "popup.shortUrlLabel": "Short URL",
  "popup.copy": "Copy",
  "popup.copied": "Copied",
  "popup.qrShow": "Show QR",
  "popup.qrHide": "Hide QR",
  "popup.qrLoading": "Generating QR...",
  "popup.qrAlt": "QR code for the short URL",
  "popup.slug.label": "Custom slug",
  "popup.slug.placeholder": "my-link",
  "popup.slug.add": "Add slug",
  "popup.slug.adding": "Adding...",
  "popup.slug.help": "Optional. Letters, numbers and hyphens. Added slugs are copied right away.",
  "popup.recent.heading": "Recent from this browser",
  "popup.viewInAdmin": "View in admin",
  "popup.openSettings": "Settings",
  "popup.retry": "Retry",

  // Popup: not configured
  "popup.notConfigured.heading": "Set up shrtnr",
  "popup.notConfigured.body": "shrtnr is self-hosted. Point this extension at your server to start shortening.",

  // Form
  "form.baseUrl.label": "Server URL",
  "form.baseUrl.placeholder": "https://your-shrtnr.example.com",
  "form.baseUrl.help": "The domain where your shrtnr Worker is deployed.",
  "form.apiKey.label": "API key",
  "form.apiKey.placeholder": "sk_...",
  "form.apiKey.help": "Create one in the admin dashboard under API Keys.",
  "form.test": "Test connection",
  "form.save": "Save",
  "form.cancel": "Cancel",
  "form.testing": "Testing...",
  "form.testOk": "Connected",
  "form.testOkCreateOnly": "Connected. This key can create links but not read them, so QR codes need a key with the read scope.",
  "form.saving": "Saving...",
  "form.saved": "Saved",

  // CTA
  "cta.heading": "Don't have a shrtnr yet?",
  "cta.body": "Deploy a free instance on Cloudflare in one click. Free tier, no credit card.",
  "cta.button": "Deploy free",

  // Errors (visible to users)
  "error.internalPage": "shrtnr can't shorten internal browser pages.",
  "error.unparseable": "Couldn't read this tab's URL.",
  "error.network": "Can't reach your shrtnr at {host}. Check the URL or your network.",
  "error.unauthorized": "Your API key was rejected. Update it in settings.",
  "error.forbidden": "This API key isn't allowed to create links.",
  "error.notFound": "shrtnr API not found at {host}. Did you mistype the host?",
  "error.conflict": "That slug is already taken. Try another.",
  "error.slugInvalid": "Slugs use letters, numbers and hyphens, and can't start or end with a hyphen.",
  "error.qrForbidden": "This API key can't read links, so it can't fetch the QR code. Use a key with the read scope.",
  "error.qrFailed": "Couldn't fetch the QR code. Try again.",
  "error.rateLimited": "Too many requests. Try again in a moment.",
  "error.server": "Your shrtnr server returned an error.",
  "error.validation": "{message}",
  "error.invalidUrl": "That's not a valid URL. Use the full address, like https://your-shrtnr.example.com.",
  "error.saveFailed": "Couldn't save your settings. Try again.",
  "error.clipboard": "Copy failed. Select the link above to copy it.",
  "error.permissionDenied": "shrtnr needs permission to talk to {host}. Click Save again and accept.",
  "error.permissionDeniedTest": "shrtnr needs permission to talk to {host}. Click Test again and accept.",

  // Options page
  "options.title": "shrtnr settings",
  "options.subtitle": "Connect this extension to your shrtnr deployment.",
  "options.section.connection": "Connection",
  "options.section.connection.body": "These values are stored in your browser's synced settings and never sent to Oddbit.",
  "options.section.connection.scope": "A key with the create scope is enough to shorten. Add the read scope if you want QR codes.",
  "options.section.shortcut": "Keyboard shortcut",
  "options.section.shortcut.body": "Alt+Shift+L opens the popup and shortens the current tab. Change it on your browser's extension shortcuts page.",
  "options.section.about": "About",
  "options.section.about.body": "shrtnr is open source and self-hosted. Source: github.com/oddbit/shrtnr.",
  "options.section.about.website": "oddbit.id",
  "options.section.about.version": "Version {version}",

  // Footer
};

export default en;
