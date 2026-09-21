// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC, PropsWithChildren } from "hono/jsx";
import { adminClientScriptPath, adminStylesheetPath } from "../assets";
import { Topbar } from "../components/topbar";
import type { TranslateFn } from "../i18n";

type LayoutProps = {
  active: string;
  theme?: string;
  lang?: string;
  t: TranslateFn;
};

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  active,
  theme,
  lang,
  t,
  children,
}) => {
  const year = new Date().getFullYear();
  const currentTheme = theme || "oddbit";
  const htmlLang = lang || "en";

  const oddbitLogo = currentTheme === "light"
    ? "/oddbit-logotype-graphite-green.svg"
    : currentTheme === "dark"
    ? "/oddbit-logotype-white.svg"
    : "/oddbit-logotype-mint-green.svg";

  const brandLogotype = currentTheme === "light"
    ? "/logotype-black.svg"
    : "/logotype-white.svg";

  const navItems = [
    { id: "dashboard", href: "/_/admin/dashboard", icon: "dashboard", label: t("nav.dashboard") },
    { id: "links", href: "/_/admin/links", icon: "link", label: t("nav.links") },
    { id: "bundles", href: "/_/admin/bundles", icon: "inventory_2", label: t("nav.bundles") },
    { id: "keys", href: "/_/admin/keys", icon: "key", label: t("nav.apiKeys") },
    { id: "settings", href: "/_/admin/settings", icon: "settings", label: t("nav.settings") },
  ];

  return (
    <html lang={htmlLang} data-theme={currentTheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>shrtnr: Admin</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="48x48" href="/icon-48.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Content-hashed and immutable (src/assets.ts): one download per deploy, not per page. */}
        <link rel="stylesheet" href={adminStylesheetPath()} />
        {/* Version in the file name: public/_headers caches it as immutable. */}
        <script src="/htmx-2.0.4.min.js" defer></script>
      </head>
      <body>
        <nav class="sidebar">
          <div class="sidebar-brand">
            <img src={brandLogotype} alt="shrtnr." />
          </div>
          <div class="sidebar-nav">
            {navItems.map((item) => (
              <a
                class={`nav-item${active === item.id ? " active" : ""}`}
                href={item.href}
              >
                <span aria-hidden="true" class="icon">{item.icon}</span> {item.label}
              </a>
            ))}
          </div>
          <div class="sidebar-footer">
            <div class="sidebar-oddbit">
              <a
                href="https://oddbit.id"
                target="_blank"
                rel="noopener"
                title="Oddbit"
              >
                <img src={oddbitLogo} alt="Oddbit" />
              </a>
              <div class="copyright">&copy; {year}</div>
            </div>
          </div>
        </nav>

        <div
          id="sidebar-backdrop"
          class="sidebar-backdrop"
          onclick="closeDrawer()"
        />

        <div class="main" id="app">
          <div class="mobile-header">
            <button
              class="mobile-menu-btn"
              onclick="toggleDrawer()"
              aria-label={t("nav.openNavigation")}
            >
              <span aria-hidden="true" class="icon">menu</span>
            </button>
            <div class="mobile-brand">
              <img src={brandLogotype} alt="shrtnr." />
            </div>
          </div>

          <Topbar active={active} t={t} />

          {children}
        </div>

        <div
          id="modal-overlay"
          class="modal-overlay"
          style="display:none"
          onclick="if(event.target===this)closeModal()"
        >
          <div class="modal" id="modal" />
        </div>

        <div id="toast" class="toast" style="display:none" />

        <script src={adminClientScriptPath(htmlLang)}></script>
      </body>
    </html>
  );
};
