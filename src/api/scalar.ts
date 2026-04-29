// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

const SCALAR_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>shrtnr API reference</title>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/_/api/openapi.json"
      data-configuration='{"theme":"deepSpace","layout":"modern"}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.53.1"></script>
  </body>
</html>`;

export function scalarResponse(): Response {
  return new Response(SCALAR_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
