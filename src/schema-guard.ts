// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * The response for a request that arrived before the schema could be
 * created. A generic 1101 tells the person who just clicked "Deploy to
 * Cloudflare" nothing; this page names the migration that failed, quotes
 * the database error, and points at the two things that help: the
 * diagnostic route and the README section.
 */

import { escHtml } from "./escape";
import { MigrationError } from "./db/migrate";
import { schemaErrorStyles } from "./styles";

export const SCHEMA_DOCS_URL = "https://github.com/oddbit/shrtnr#database-schema";

const JSON_PREFIXES = ["/_/api/", "/_/admin/api/", "/_/admin/w/", "/_/mcp"];

function wantsJson(request: Request): boolean {
  const path = new URL(request.url).pathname;
  if (JSON_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix))) return true;
  return (request.headers.get("Accept") ?? "").includes("application/json");
}

export function schemaErrorResponse(err: unknown, request: Request): Response {
  const migration = err instanceof MigrationError ? err.migration : null;
  const cause = err instanceof MigrationError ? err.cause : err;
  const reason = cause instanceof Error ? cause.message : String(cause);
  const headers = { "Cache-Control": "no-store", "Retry-After": "30" };

  if (wantsJson(request)) {
    return Response.json(
      { error: migration ? `Migration ${migration} failed: ${reason}` : `Database setup failed: ${reason}`, migration, docs: SCHEMA_DOCS_URL },
      { status: 503, headers },
    );
  }

  const step = migration
    ? `The database migration <code>${escHtml(migration)}</code> failed.`
    : "The Worker could not read or create its migration bookkeeping table in D1.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database setup failed</title>
  <link rel="icon" href="/favicon.ico" />
  <style>${schemaErrorStyles}</style>
</head>
<body>
  <main class="notice">
    <p class="eyebrow">shrtnr: database setup</p>
    <h1>This deployment's database is not ready yet</h1>
    <p>${step} Nothing is broken beyond repair: the Worker applies its schema on the first request and will try again on the next one.</p>
    <pre class="error">${escHtml(reason)}</pre>
    <h2>What to do</h2>
    <ol>
      <li>Open <a href="/_/setup"><code>/_/setup</code></a> to see which migrations are applied and which are pending, or send it a POST to retry now.</li>
      <li>Check that the Worker has a D1 binding named <code>DB</code> in the Cloudflare dashboard under Settings, Bindings.</li>
      <li>Read the <a href="${SCHEMA_DOCS_URL}">database schema section of the README</a> for the CLI path and the workflow that applies migrations from CI.</li>
    </ol>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html;charset=UTF-8" },
  });
}
