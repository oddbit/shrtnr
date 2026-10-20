// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Link } from "../models";

/**
 * Fills in `shortOrigin` on a link, or on each link of a list, that arrived
 * without it. A deployment older than the field answers without it, and the
 * SDK can be upgraded before the Worker is redeployed. The origin of the
 * client's base URL is the origin such a deployment hands out.
 */
export function withShortOrigin<T extends Link | Link[]>(value: T, origin: string): T {
  const fill = (link: Link): Link => (link.shortOrigin ? link : { ...link, shortOrigin: origin });
  return (Array.isArray(value) ? value.map(fill) : fill(value)) as T;
}
