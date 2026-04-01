// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { GOOGLE_FONTS_HREF, standaloneBaseStyles } from "../styles";
import type { ApprovalDialogOptions } from "./workers-oauth-utils";
import { sanitizeText, sanitizeUrl } from "./workers-oauth-utils";

export function renderApprovalDialog(
  request: Request,
  options: ApprovalDialogOptions,
): Response {
  const { client, server, state, csrfToken, setCookie } = options;

  const encodedState = btoa(JSON.stringify(state));
  const serverName = sanitizeText(server.name);
  const clientName = client?.clientName ? sanitizeText(client.clientName) : "Unknown MCP Client";
  const serverDescription = server.description ? sanitizeText(server.description) : "";

  const clientUri = client?.clientUri ? sanitizeText(sanitizeUrl(client.clientUri)) : "";
  const redirectUris =
    client?.redirectUris && client.redirectUris.length > 0
      ? client.redirectUris
          .map((uri) => { const v = sanitizeUrl(uri); return v ? sanitizeText(v) : ""; })
          .filter((uri) => uri !== "")
      : [];

  const html = approvalDialogHtml({
    serverName,
    clientName,
    serverDescription,
    clientUri,
    redirectUris,
    encodedState,
    csrfToken,
    action: new URL(request.url).pathname,
  });

  return new Response(html, {
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": setCookie,
      "X-Frame-Options": "DENY",
    },
  });
}

interface ApprovalDialogHtmlParams {
  serverName: string;
  clientName: string;
  serverDescription: string;
  clientUri: string;
  redirectUris: string[];
  encodedState: string;
  csrfToken: string;
  action: string;
}

function approvalDialogHtml(p: ApprovalDialogHtmlParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${p.serverName}: Authorize MCP Client</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${GOOGLE_FONTS_HREF}" rel="stylesheet">
  <style>
    ${standaloneBaseStyles}
    .container { max-width: 520px; margin: 3rem auto; padding: 1rem; }
    .header { text-align: center; margin-bottom: 2rem; display: flex; flex-direction: column; align-items: center; }
    .logo-wrap img { width: 168px; height: auto; display: block; }
    .logo-sub { font-family: var(--font-display); font-size: 0.8rem; font-weight: 700; color: var(--on-bg-muted); letter-spacing: 0.4em; text-transform: uppercase; margin-top: 0.2rem; text-align: right; }
    .header p { color: var(--on-bg-muted); font-size: 0.9rem; margin-top: 1.5rem; max-width: 400px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
    .alert { font-size: 1.1rem; font-weight: 500; margin-bottom: 1rem; text-align: center; }
    .client-info { border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; margin-bottom: 1.5rem; }
    .detail { display: flex; margin-bottom: 0.5rem; align-items: baseline; }
    .detail-label { font-weight: 500; min-width: 100px; color: var(--on-bg-muted); font-size: 0.85rem; }
    .detail-value { font-size: 0.85rem; word-break: break-all; }
    .detail-value a { color: var(--primary); text-decoration: none; }
    .actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .btn { padding: 0.6rem 1.25rem; border-radius: var(--radius); font-weight: 500; cursor: pointer; border: none; font-size: 0.9rem; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--on-bg); }
    @media (max-width: 540px) {
      .container { margin: 1rem auto; }
      .actions { flex-direction: column; }
      .btn { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-wrap">
          <img src="/logotype-white.svg" alt="${p.serverName}" width="168">
          <div class="logo-sub">MCP SERVER</div>
        </div>
      ${p.serverDescription ? `<p>${p.serverDescription}</p>` : ""}
    </div>
    <div class="card">
      <div class="alert"><strong>${p.clientName}</strong> is requesting access</div>
      <div class="client-info">
        <div class="detail">
          <div class="detail-label">Client</div>
          <div class="detail-value">${p.clientName}</div>
        </div>
        ${p.clientUri ? `<div class="detail"><div class="detail-label">Website</div><div class="detail-value"><a href="${p.clientUri}" target="_blank" rel="noopener noreferrer">${p.clientUri}</a></div></div>` : ""}
        ${p.redirectUris.length > 0 ? `<div class="detail"><div class="detail-label">Redirect</div><div class="detail-value">${p.redirectUris.join("<br>")}</div></div>` : ""}
      </div>
      <p style="font-size:0.85rem;color:var(--on-bg-muted)">Approving will redirect you to sign in with your identity provider. Only approve if you trust this client.</p>
      <form method="post" action="${p.action}">
        <input type="hidden" name="state" value="${p.encodedState}">
        <input type="hidden" name="csrf_token" value="${p.csrfToken}">
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick="window.history.back()">Cancel</button>
          <button type="submit" class="btn btn-primary">Approve</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}
