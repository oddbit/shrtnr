// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export const DEPLOY_CTA_URL = "https://oddb.it/shrtnr-deploy-ext";
export const PROJECT_INFO_URL = "https://oddb.it/shrtnr-info";

export const COPY_CONFIRM_DURATION_MS = 1500;
export const QR_SIZE_PX = 256;

// Mirrors the server's custom slug rule (CustomSlugStringSchema in
// src/api/schemas.ts): alphanumeric ends, hyphens allowed in the middle,
// at most MAX_SLUG_LENGTH characters. The server lowercases before it
// checks, so the client check is case-insensitive.
export const MAX_SLUG_LENGTH = 128;
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

// Client-side list of the links shortened from this browser, kept in
// chrome.storage.local so it never leaves the device.
export const RECENT_LIMIT = 5;
