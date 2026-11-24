// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The API reference is the one page on this origin that runs a script from
// another host, and it shares its origin with the admin. The version is
// pinned and the browser checks the bytes against this hash, so a changed
// file on the CDN does not run. Update both together:
//   curl -sL https://cdn.jsdelivr.net/npm/@scalar/api-reference@<version> \
//     | openssl dgst -sha384 -binary | openssl base64 -A
const SCALAR_VERSION = "1.53.1";
const SCALAR_INTEGRITY = "sha384-ND7YXSTlSaERCGjrMfNoaYd110VLtz0AfVgEK45xN1nhCxWIsVnCwBKp3mA5C+Qb";

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
    <script
      src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"
      integrity="${SCALAR_INTEGRITY}"
      crossorigin="anonymous"></script>
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
