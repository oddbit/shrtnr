// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export {
  listLinks,
  getLink,
  getLinkBySlug,
  createLink,
  updateLink,
  disableLink,
  addCustomSlugToLink,
  getLinkAnalytics,
  getDashboardStats,
  searchLinks,
  findSlugForRedirect,
  recordClick,
} from "./link-management";

export {
  listAllApiKeys,
  createNewApiKey,
  deleteApiKeyById,
  authenticateApiKey,
  getAppSettings,
  updateAppSettings,
} from "./admin-management";

export type { ServiceResult } from "./result";
