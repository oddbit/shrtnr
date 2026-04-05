// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { GOOGLE_FONTS_HREF, standaloneCenteredStyles } from "../styles";

export function landingResponse(): Response {
  return new Response(LANDING_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>shrtnr.</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="48x48" href="/icon-48.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${GOOGLE_FONTS_HREF}" rel="stylesheet">
  <style>${standaloneCenteredStyles}
    .logotype {
      height: clamp(3rem, 12vw, 7rem);
      display: block;
      user-select: none;
    }
    .subtitle {
      font-family: var(--font-family-display);
      font-size: clamp(0.65rem, 2vw, 0.9rem);
      font-weight: 700;
      letter-spacing: 0.35em;
      color: var(--color-text-muted);
      margin-top: 1rem;
    }
    .login-link {
      margin-top: 3.5rem;
      font-family: var(--font-family-body);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-accent);
      text-decoration: none;
      letter-spacing: 0.05em;
      border-bottom: 1px solid transparent;
      transition: border-color 0.15s;
    }
    .login-link:hover {
      border-color: var(--color-accent);
    }
    .footer {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      opacity: 0.45;
    }
    .footer img {
      height: 1.6rem;
      display: block;
    }
    .footer-copy {
      font-family: var(--font-family-body);
      font-size: 0.7rem;
      color: var(--color-text-muted);
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <img class="logotype" src="/logotype-white.svg" alt="shrtnr." />
  <div class="subtitle">URL SHORTENER</div>
  <a class="login-link" href="/_/admin/dashboard">login</a>
  <footer class="footer">
    <a href="https://oddbit.id" target="_blank" rel="noopener" title="Oddbit">
      <img src="/oddbit-logotype-mint-green.svg" alt="Oddbit" />
    </a>
    <span class="footer-copy">&copy; ${new Date().getFullYear()}</span>
  </footer>
</body>
</html>`;
