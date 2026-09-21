// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { PRELOAD_TEXT_FONTS, standaloneCenteredStyles } from "./styles";

export function notFoundResponse(): Response {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "private, no-cache, must-revalidate",
    },
  });
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="48x48" href="/icon-48.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  ${PRELOAD_TEXT_FONTS.map((href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`).join("\n  ")}
  <style>${standaloneCenteredStyles}
    .code {
      font-size: clamp(10rem, 30vw, 28rem);
      font-weight: 700;
      line-height: 1;
      color: var(--color-accent);
      letter-spacing: -0.02em;
      user-select: none;
    }
    .label {
      font-size: clamp(1rem, 3vw, 1.75rem);
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.3em;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="code">404</div>
  <div class="label">Not found</div>
</body>
</html>`;
