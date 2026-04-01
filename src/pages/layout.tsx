// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import { adminStyles } from "../styles";
import { adminClientScript } from "../client";
import type { TranslateFn } from "../i18n";
import type { Translations } from "../i18n/types";
import pkg from "../../package.json";

const ODDBIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2578.3 660.9"><path fill="currentColor" d="M49.5,369.5c-1,7.6-1.9,18-1.9,36.2,0,108.5,88.6,199.9,191.5,199.9s185.6-85.7,185.6-196.2-81-192.3-194.2-192.3S55.2,288.5,27.6,319l56.1-110.5c33.3-22.9,95.2-46.7,151.4-46.7,136.1,0,248.6,112.3,248.6,249.5s-110.5,249.5-244.7,249.5S25.6,595.2,0,465.7l49.5-96.2Z"/><path fill="currentColor" d="M521.8,411.3c0-141,112.3-243.7,227.6-243.7s108.5,18.2,143.8,43.8l36.2,71.4c-44.8-34.2-106.6-61.8-164.7-61.8-111.5,0-183.8,93.3-183.8,190.5s79,194.2,188.5,194.2,182.9-80,182.9-194.2V0h59.1v411.3c0,149.4-124.8,249.5-241.9,249.5s-247.6-110.5-247.6-249.5Z"/><path fill="currentColor" d="M1060.6,411.3c0-141,112.3-243.7,227.6-243.7s108.5,18.2,143.8,43.8l36.2,71.4c-44.8-34.2-106.6-61.8-164.7-61.8-111.5,0-183.8,93.3-183.8,190.5s79,194.2,188.5,194.2,182.9-80,182.9-194.2V0h59.1v411.3c0,149.4-124.8,249.5-241.9,249.5s-247.6-110.5-247.6-249.5Z"/><path fill="currentColor" d="M1614.7,411.3V0h59.1v411.3c0,114.2,90.5,194.2,182.9,194.2s188.5-91.3,188.5-194.2-72.4-190.5-183.8-190.5-119.9,27.6-164.7,61.8l36.2-71.4c35.2-25.6,85.7-43.8,143.8-43.8,115.2,0,227.6,102.9,227.6,243.7s-110.5,249.5-247.6,249.5-241.9-99.9-241.9-249.5v.2Z"/><path fill="currentColor" d="M2147.9,70.4c0-21.9,19-39.9,40.9-39.9s40.9,18.2,40.9,39.9-19,39.9-40.9,39.9-40.9-18.2-40.9-39.9ZM2159.2,647.5V175.2h59.1v472.3h-59.1Z"/><path fill="currentColor" d="M2286.8,464.7V187.5l59.1-61.8v315.1c0,102.9,55.2,164.7,140,164.7s64.7-8.6,92.3-26.6v53.4c-27.6,20-60,28.6-97.2,28.6-106.6,0-194.2-84.7-194.2-196.2ZM2365,230.4l28.6-55.2h184.8v55.2h-213.4Z"/></svg>`;

type LayoutProps = {
  active: string;
  theme?: string;
  lang?: string;
  t: TranslateFn;
  translations: Translations;
};

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  active,
  theme,
  lang,
  t,
  translations,
  children,
}) => {
  const year = new Date().getFullYear();
  const currentTheme = theme || "oddbit";
  const htmlLang = lang || "en";

  const navItems = [
    { id: "dashboard", href: "/_/admin/dashboard", icon: "dashboard", label: t("nav.dashboard") },
    { id: "links", href: "/_/admin/links", icon: "link", label: t("nav.links") },
    { id: "keys", href: "/_/admin/keys", icon: "key", label: t("nav.apiKeys") },
    { id: "settings", href: "/_/admin/settings", icon: "settings", label: t("nav.settings") },
  ];

  return (
    <html lang={htmlLang} data-theme={currentTheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>shrtnr: Admin</title>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <style>{raw(adminStyles)}</style>
      </head>
      <body>
        <nav class="sidebar">
          <div class="sidebar-brand">
            shrtnr<span>.</span>
          </div>
          <div class="sidebar-nav">
            {navItems.map((item) => (
              <a
                class={`nav-item${active === item.id ? " active" : ""}`}
                href={item.href}
              >
                <span class="icon">{item.icon}</span> {item.label}
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
                {raw(ODDBIT_SVG)}
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
              <span class="icon">menu</span>
            </button>
            <div class="mobile-brand">
              shrtnr<span>.</span>
            </div>
          </div>

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

        <script>{raw(adminClientScript(pkg.version, translations))}</script>
      </body>
    </html>
  );
};
