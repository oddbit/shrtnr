// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { GOOGLE_FONTS_HREF, standaloneBaseStyles } from "../styles";

export function mcpLandingResponse(): Response {
  return new Response(MCP_LANDING_HTML, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

const MCP_LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>shrtnr: MCP</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="48x48" href="/icon-48.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${GOOGLE_FONTS_HREF}" rel="stylesheet">
  <style>${standaloneBaseStyles}
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .logo-wrap img {
      display: block;
      height: clamp(5rem, 20vw, 12rem);
      width: auto;
    }
    .label {
      font-family: var(--font-family-display);
      font-size: clamp(0.75rem, 2vw, 1rem);
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.4em;
      margin-top: 0.35em;
    }
  </style>
</head>
<body>
  <div class="logo-wrap">
    <img src="/logotype-white.svg" alt="shrtnr.">
    <div class="label">MCP Server</div>
  </div>
</body>
</html>`;
