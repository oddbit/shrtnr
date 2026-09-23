import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        d1Databases: { DB: "test-db" },
        kvNamespaces: ["SLUG_KV"],
        // Tests assume dev mode (DEV_MODE, see isDevMode in src/access.ts)
        // and DEV_IDENTITY set to "dev@local". Locally these flow in via
        // .dev.vars, but that file is git-ignored and absent in CI. Bind
        // them here so behavior is identical in both places. Tests of a
        // deployment override DEV_MODE per request.
        bindings: { DEV_MODE: "true", DEV_IDENTITY: "dev@local" },
        // Keep the suite off the network. Every link a handler test creates
        // schedules autoLabelLink() in waitUntil, which fetches the link's
        // URL for a <title>. Without this, that fetch left the sandbox for
        // real: workerd logged DNS failures for cached.example.com and TLS
        // handshake errors against parked domains, and in CI one stalled
        // handshake carried the "301 redirect via a custom slug" test past
        // vitest's 5s timeout. SELF.fetch does not wait on waitUntil, so a
        // slow fetch also outlived its test and wrote a label into the next
        // test's rolled-back storage (D1 FOREIGN KEY constraint failed).
        //
        // The stub answers every outbound fetch at once with a non-HTML
        // body, so fetchPageTitle() returns null and autoLabelLink() writes
        // nothing. Tests that need a specific outbound response stub the
        // global fetch themselves (see title-fetch.test.ts).
        outboundService: (request) =>
          new Response(`outbound fetch stubbed by vitest.config.mts: ${request.url}`, {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      },
    }),
  ],
  test: {
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
  },
});
