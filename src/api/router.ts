// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import pkg from "../../package.json";
import { scalarResponse } from "./scalar";
import { createApiSubApp } from "./sub-app";
import { linksApp } from "./links";
import { slugsApp } from "./slugs";
import { bundlesApp } from "./bundles";

export const apiRouter = createApiSubApp();

apiRouter.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "sk_*",
  description: "API key issued from the admin dashboard. Pass as `Authorization: Bearer sk_...`.",
});

/**
 * The one `info` block for the public API document. `doc31` serves it at
 * `/_/api/openapi.json` and `scripts/emit-spec.ts` hashes it, so both read
 * this object rather than carrying their own copy.
 */
export const openApiConfig: Parameters<typeof apiRouter.getOpenAPI31Document>[0] = {
  openapi: "3.1.0",
  info: {
    title: "shrtnr API",
    version: pkg.version,
    description:
      "Public link-management API for shrtnr, a self-hosted URL shortener on Cloudflare Workers. " +
      "Authenticate with an API key issued from the admin dashboard.\n\n" +
      "## Permissions\n\n" +
      "A key carries the identity of whoever issued it, and that identity owns everything the key creates. " +
      "Reads are open across owners: any key with the `read` scope lists and fetches every link, bundle and " +
      "analytics figure on the deployment. Writes are owner-scoped: updating, disabling, enabling or deleting " +
      "a link or a bundle, and changing its slugs, is refused with 403 for any identity other than the owner. " +
      "Two calls are open by design and carry no owner check: adding a custom slug to a link, and adding a " +
      "link to a bundle.\n\n" +
      "A link or a custom slug can be deleted only while it has recorded zero clicks. After that the delete is " +
      "refused with 400 and disable is the operation that works, since a clicked short link is already in " +
      "circulation and deleting it frees its slug for reuse. Bundles carry no such rule.\n\n" +
      "Scopes are a separate gate applied first: a `read` key is refused on every write with 403 before " +
      "ownership is consulted.\n\n" +
      "Built and maintained by Oddbit (https://oddbit.id).",
    contact: { name: "Oddbit", url: "https://oddbit.id" },
    license: { name: "Apache 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  servers: [{ url: "/" }],
  security: [{ bearerAuth: [] }],
};

apiRouter.doc31("/openapi.json", openApiConfig);

apiRouter.get("/docs", (_c) => scalarResponse());

apiRouter.route("/links", linksApp);
apiRouter.route("/slugs", slugsApp);
apiRouter.route("/bundles", bundlesApp);
