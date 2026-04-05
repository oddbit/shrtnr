// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { SlugRepository } from "./db";
import { MIN_SLUG_LENGTH } from "./constants";

// Unambiguous lowercase characters: removed l, o, 0, 1 to avoid confusion
export const RANDOM_CHARSET = "abcdefghijkmnpqrstuvwxyz23456789";
const RANDOM_SLUG_REGEX = /^[a-z0-9]+$/;
const CUSTOM_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function generateRandomSlug(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => RANDOM_CHARSET[b % RANDOM_CHARSET.length]).join("");
}

export async function generateUniqueSlug(db: D1Database, length: number): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = generateRandomSlug(length);
    if (!(await SlugRepository.exists(db, slug))) {
      return slug;
    }
  }
  throw new Error("Failed to generate unique slug after 10 attempts");
}

export function validateRandomSlug(slug: string): string | null {
  if (slug.length < MIN_SLUG_LENGTH) return `Slug must be at least ${MIN_SLUG_LENGTH} characters`;
  if (slug.startsWith("_")) return "Slug must not start with underscore";
  if (!RANDOM_SLUG_REGEX.test(slug)) return "Slug must contain only alphanumeric characters";
  return null;
}

export function validateCustomSlug(slug: string): string | null {
  if (slug.length < 1) return "Custom slug must not be empty";
  if (slug.startsWith("_")) return "Slug must not start with underscore";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Custom slug must not start or end with a hyphen";
  if (!CUSTOM_SLUG_REGEX.test(slug)) return "Custom slug must contain only alphanumeric characters and hyphens";
  return null;
}


export function validateSlugLength(length: number): string | null {
  if (!Number.isInteger(length) || length < MIN_SLUG_LENGTH) return `Slug length must be an integer >= ${MIN_SLUG_LENGTH}`;
  if (length > 128) return "Slug length must be an integer <= 128";
  return null;
}
