// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

const en = {
  "_lang": "en",

  // Brand
  "brand.name": "shrtnr",
  "brand.tagline": "Self-hosted URL shortener",

  // Popup — generic
  "popup.loading": "Shortening...",
  "popup.shortUrlLabel": "Short URL",
  "popup.copy": "Copy",
  "popup.copyAgain": "Copy again",
  "popup.copied": "Copied",
  "popup.qrShow": "Show QR",
  "popup.qrHide": "Hide QR",
  "popup.qrLoading": "Generating QR...",
  "popup.viewInAdmin": "View in admin",
  "popup.openSettings": "Settings",
  "popup.retry": "Retry",
  "popup.openAdmin": "Open admin",

  // Popup — not configured
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
  "error.rateLimited": "Too many requests. Try again in a moment.",
  "error.server": "Your shrtnr server returned an error.",
  "error.validation": "{message}",
  "error.clipboard": "Copy failed. Select the link above to copy it.",
  "error.permissionDenied": "shrtnr needs permission to talk to {host}. Click Save again and accept.",
  "error.tabUnknown": "Couldn't read the active tab.",

  // Options page
  "options.title": "shrtnr settings",
  "options.subtitle": "Connect this extension to your shrtnr deployment.",
  "options.section.connection": "Connection",
  "options.section.connection.body": "These values are stored in your browser's synced settings and never sent to Oddbit.",
  "options.section.about": "About",
  "options.section.about.body": "shrtnr is open source and self-hosted. Source: github.com/oddbit/shrtnr.",
  "options.section.about.website": "oddbit.id",
  "options.section.about.version": "Version {version}",

  // Footer
  "footer.poweredBy": "Powered by shrtnr by Oddbit",
};

export default en;
