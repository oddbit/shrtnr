// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";

type Props = {
  theme: string;
  slugLength: number;
};

export const SettingsPage: FC<Props> = ({ theme, slugLength }) => {
  const combos = Math.pow(56, Math.max(slugLength, 3));
  const comboHint =
    slugLength >= 3
      ? `${combos.toLocaleString()} possible combinations`
      : "Minimum length is 3 characters";

  return (
    <>
      <div class="page-header">
        <div class="page-title">Settings</div>
        <div class="page-subtitle">Configure your URL shortener</div>
      </div>

      <div
        class="settings-layout"
        style="display:flex;gap:2.5rem;align-items:flex-start;flex-wrap:wrap"
      >
        <div style="flex:1;min-width:280px;max-width:480px">
          <div class="bento-card">
            <div class="form-group">
              <label class="form-label">Theme</label>
              <div class="theme-toggle" id="theme-picker">
                <button
                  class={`theme-btn${theme === "oddbit" ? " active" : ""}`}
                  data-theme="oddbit"
                  onclick="setTheme('oddbit')"
                >
                  <span class="icon">eco</span> Oddbit
                </button>
                <button
                  class={`theme-btn${theme === "dark" ? " active" : ""}`}
                  data-theme="dark"
                  onclick="setTheme('dark')"
                >
                  <span class="icon">dark_mode</span> Dark
                </button>
                <button
                  class={`theme-btn${theme === "light" ? " active" : ""}`}
                  data-theme="light"
                  onclick="setTheme('light')"
                >
                  <span class="icon">light_mode</span> Light
                </button>
              </div>
            </div>
          </div>

          <div class="bento-card" style="margin-top:1.4rem">
            <div class="form-group">
              <label class="form-label">Default Slug Length</label>
              <div style="display:flex;gap:0.75rem;align-items:center">
                <input
                  class="form-input"
                  type="number"
                  id="slug-length-input"
                  min="3"
                  value={String(slugLength)}
                  style="width:80px"
                />
                <button class="btn btn-secondary btn-sm" onclick="saveSettings()">
                  Save
                </button>
              </div>
              <div
                style="font-size:0.75rem;color:var(--on-bg-muted);margin-top:0.4rem"
                id="slug-combo-hint"
              >
                {comboHint}
              </div>
            </div>
          </div>

          <div class="bento-card" style="margin-top:1.4rem">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Version</label>
              <div id="version-status" style="font-size:0.875rem">
                <span style="color:var(--on-bg-muted)">
                  <span
                    class="icon"
                    style="font-size:16px;vertical-align:text-bottom;animation:spin 1s linear infinite"
                  >
                    progress_activity
                  </span>{" "}
                  Checking for updates...
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style="min-width:240px;max-width:300px;display:flex;flex-direction:column;gap:1.4rem">
          <div style="font-size:0.75rem;color:var(--secondary);font-weight:600;text-transform:uppercase">
            Integrations
          </div>
          <a
            href="https://www.npmjs.com/package/@oddbit/shrtnr"
            target="_blank"
            rel="noopener"
            class="bento-card"
            style="text-decoration:none;color:inherit;display:block"
          >
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
              <span class="icon" style="color:var(--primary)">
                terminal
              </span>
              <span style="font-weight:600">TypeScript SDK</span>
            </div>
            <div style="font-size:0.813rem;color:var(--on-bg-muted);line-height:1.45">
              Manage links from your own code. Create, update, disable, and read
              click analytics programmatically.
            </div>
            <div style="font-size:0.7rem;color:var(--secondary);margin-top:0.6rem;display:flex;align-items:center;gap:0.25rem">
              <span class="icon" style="font-size:14px">
                open_in_new
              </span>{" "}
              @oddbit/shrtnr
            </div>
          </a>
          <a
            href="https://www.npmjs.com/package/@oddbit/shrtnr-mcp"
            target="_blank"
            rel="noopener"
            class="bento-card"
            style="text-decoration:none;color:inherit;display:block"
          >
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
              <span class="icon" style="color:var(--primary)">
                smart_toy
              </span>
              <span style="font-weight:600">MCP Server</span>
            </div>
            <div style="font-size:0.813rem;color:var(--on-bg-muted);line-height:1.45">
              Give AI assistants access to your links. Works with Claude Desktop
              and GitHub Copilot in VS Code.
            </div>
            <div style="font-size:0.7rem;color:var(--secondary);margin-top:0.6rem;display:flex;align-items:center;gap:0.25rem">
              <span class="icon" style="font-size:14px">
                open_in_new
              </span>{" "}
              @oddbit/shrtnr-mcp
            </div>
          </a>
        </div>
      </div>
    </>
  );
};
