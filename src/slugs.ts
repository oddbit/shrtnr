// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { dbSlugExists } from "./db";

// Unambiguous characters: removed I, O, l, o, 0, 1 to avoid confusion
const RANDOM_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const RANDOM_SLUG_REGEX = /^[a-zA-Z0-9]+$/;
const VANITY_SLUG_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

export function generateRandomSlug(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => RANDOM_CHARSET[b % RANDOM_CHARSET.length]).join("");
}

export async function generateUniqueSlug(db: D1Database, length: number): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = generateRandomSlug(length);
    if (!(await dbSlugExists(db, slug))) {
      return slug;
    }
  }
  throw new Error("Failed to generate unique slug after 10 attempts");
}

export function validateRandomSlug(slug: string): string | null {
  if (slug.length < 3) return "Slug must be at least 3 characters";
  if (slug.startsWith("_")) return "Slug must not start with underscore";
  if (!RANDOM_SLUG_REGEX.test(slug)) return "Slug must contain only alphanumeric characters";
  return null;
}

export function validateVanitySlug(slug: string): string | null {
  if (slug.length < 1) return "Vanity slug must not be empty";
  if (slug.startsWith("_")) return "Slug must not start with underscore";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Vanity slug must not start or end with a hyphen";
  if (!VANITY_SLUG_REGEX.test(slug)) return "Vanity slug must contain only alphanumeric characters and hyphens";
  return null;
}

export function validateSlugLength(length: number): string | null {
  if (!Number.isInteger(length) || length < 3) return "Slug length must be an integer >= 3";
  if (length > 128) return "Slug length must be an integer <= 128";
  return null;
}
