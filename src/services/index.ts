// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

export {
  listLinks,
  getLink,
  getLinkBySlug,
  createLink,
  updateLink,
  disableLink,
  enableLink,
  deleteLink,
  addCustomSlugToLink,
  getLinkAnalytics,
  getLinkTimeline,
  getDashboardStats,
  searchLinks,
  listLinksByOwner,
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

export {
  createBundle,
  listBundles,
  getBundle,
  updateBundle,
  archiveBundle,
  unarchiveBundle,
  deleteBundle,
  addLinkToBundle,
  removeLinkFromBundle,
  getBundleAnalytics,
  listBundleLinks,
  listBundlesForLink,
} from "./bundle-management";

export type { ServiceResult } from "./result";
