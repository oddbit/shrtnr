// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type ApiKey = {
  id: number;
  title: string;
  key_prefix: string;
  scope: string;
  created_at: number;
  last_used_at: number | null;
};

type Props = {
  keys: ApiKey[];
};

export const KeysPage: FC<Props> = ({ keys }) => {
  return (
    <>
      <div class="page-header">
        <div class="page-title">API Keys</div>
        <div class="page-subtitle">
          Manage programmatic access to the shortener API
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-count">
          {keys.length} key{keys.length !== 1 ? "s" : ""}
        </div>
        <button class="btn btn-primary" onclick="showCreateKeyModal()">
          <span class="icon">add</span> New Key
        </button>
      </div>

      {keys.length === 0 ? (
        <div class="empty-state">
          <span class="icon">key_off</span>
          <p>
            No API keys yet. Use the <strong>+ New Key</strong> button above to
            enable programmatic access.
          </p>
        </div>
      ) : (
        <div class="bento-card" style="padding:0">
          <div class="keys-table-scroll">
            <table class="keys-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Key</th>
                  <th>Scope</th>
                  <th>Created</th>
                  <th>Last Used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const scopes = k.scope.split(",");
                  return (
                    <tr>
                      <td data-label="Title" style="font-weight:600">
                        {k.title}
                      </td>
                      <td data-label="Key">
                        <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--on-bg-muted)">
                          {k.key_prefix}&hellip;
                        </span>
                      </td>
                      <td data-label="Scope">
                        {scopes.map((s) => (
                          <span class={`scope-badge ${s}`}>{s} </span>
                        ))}
                      </td>
                      <td
                        data-label="Created"
                        style="color:var(--on-bg-muted);font-size:0.8rem"
                      >
                        {formatDate(k.created_at)}
                      </td>
                      <td data-label="Last Used" style="font-size:0.8rem">
                        {k.last_used_at ? (
                          formatDate(k.last_used_at)
                        ) : (
                          <span style="color:var(--on-bg-muted)">Never</span>
                        )}
                      </td>
                      <td>
                        <button
                          class="btn btn-danger btn-sm"
                          onclick={`deleteKey(${k.id},'${escHtml(k.title).replace(/'/g, "\\'")}')`}
                        >
                          <span class="icon" style="font-size:16px">
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
