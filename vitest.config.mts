import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        d1Databases: { DB: "test-db" },
        kvNamespaces: ["SLUG_KV"],
        // Tests assume DEV_IDENTITY is set to "dev@local". Locally this
        // flows in via .dev.vars, but that file is git-ignored and absent
        // in CI. Bind it here so behavior is identical in both places.
        bindings: { DEV_IDENTITY: "dev@local" },
      },
    }),
  ],
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
});
