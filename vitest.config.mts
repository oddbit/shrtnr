import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        d1Databases: { DB: "test-db" },
        kvNamespaces: ["OAUTH_KV"],
        durableObjects: {
          MCP_OBJECT: "ShrtnrMCP",
        },
      },
    }),
  ],
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
});
