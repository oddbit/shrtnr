// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 128;
export const DEFAULT_SLUG_LENGTH = MIN_SLUG_LENGTH;

export const TIMELINE_RANGES = ["24h", "7d", "30d", "90d", "1y", "all"] as const;
export const DEFAULT_TIMELINE_RANGE: (typeof TIMELINE_RANGES)[number] = "30d";

export const THEMES = ["oddbit", "dark", "light"] as const;
export const DEFAULT_THEME: (typeof THEMES)[number] = "oddbit";

export const MAX_TITLE_LENGTH = 120;

export const MIN_QR_SIZE = 1;
export const MAX_QR_SIZE = 2048;
export const DEFAULT_QR_SIZE = 220;
