// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * The answer on /_/admin/* for a deployment that has no ACCESS_AUD and is
 * not a dev server. Without the AUD tag the Worker cannot verify the Access
 * JWT, and every other identity source (the email header, an unsigned JWT,
 * the dev_identity cookie) is text any caller can write. Taking one of those
 * on a public host, such as a workers.dev URL that no Access application
 * covers, would let a stranger act as any owner. So the admin surface stays
 * shut and tells the operator what to set, the way the schema page does for
 * a missing database. Short links keep redirecting throughout.
 */

import { schemaErrorStyles } from "./styles";

export const ACCESS_DOCS_URL = "https://github.com/oddbit/shrtnr/blob/main/docs/access-control.md";

const MESSAGE =
  "Cloudflare Access verification is not configured. Set the ACCESS_AUD and ACCESS_JWKS_URL secrets on the Worker.";

export function accessNotConfiguredResponse(request: Request): Response {
  const headers = { "Cache-Control": "no-store" };

  if (new URL(request.url).pathname.startsWith("/_/admin/api/")) {
    return Response.json({ error: MESSAGE, docs: ACCESS_DOCS_URL }, { status: 503, headers });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Protect this deployment</title>
  <link rel="icon" href="/favicon.ico" />
  <style>${schemaErrorStyles}</style>
</head>
<body>
  <main class="notice">
    <p class="eyebrow">shrtnr: access setup</p>
    <h1>Protect this deployment to open the admin pages</h1>
    <p>The Worker verifies every admin request against Cloudflare Access, and it has no Access application to verify against yet. Short links keep redirecting in the meantime.</p>
    <h2>What to do</h2>
    <ol>
      <li>In the Cloudflare dashboard, open <strong>Workers &amp; Pages</strong>, select this Worker, go to <strong>Settings &gt; Domains &amp; Routes</strong> and select <strong>Enable Cloudflare Access</strong> for <code>workers.dev</code>. For a custom domain, add a self-hosted Access application for it instead, or as well.</li>
      <li>Copy the application's <strong>Application Audience (AUD) Tag</strong> from its overview in Zero Trust, and store it as the <code>ACCESS_AUD</code> secret. List both tags, separated by a comma, when the Worker sits behind two applications.</li>
      <li>Store <code>https://&lt;your-team-name&gt;.cloudflareaccess.com/cdn-cgi/access/certs</code> as the <code>ACCESS_JWKS_URL</code> secret.</li>
      <li>Reload this page and sign in through Access.</li>
    </ol>
    <p>The <a href="${ACCESS_DOCS_URL}">access control guide</a> walks through each step. Running <code>wrangler dev</code> on your own machine? Add <code>DEV_MODE=true</code> to <code>.dev.vars</code> and sign in at <code>/_/dev/login</code>.</p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html;charset=UTF-8" },
  });
}
