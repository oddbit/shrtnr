// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { FC } from "hono/jsx";
import type { TranslateFn } from "../i18n";

// The three published SDKs, sourced once here so the keys page and the
// settings page never drift apart. Package coordinates live in the shared
// `settings.sdk*` i18n strings.
const SDKS = [
  { href: "https://oddb.it/shrtnr-npm-app", lang: "settings.sdkTsLang", pkg: "settings.sdkTsPkg" },
  { href: "https://oddb.it/shrtnr-pypi-app", lang: "settings.sdkPythonLang", pkg: "settings.sdkPythonPkg" },
  { href: "https://oddb.it/shrtnr-pub-app", lang: "settings.sdkDartLang", pkg: "settings.sdkDartPkg" },
] as const;

type Props = {
  t: TranslateFn;
};

export const SdkList: FC<Props> = ({ t }) => (
  <ul class="integration-sdk-list">
    {SDKS.map((sdk) => (
      <li>
        <a href={sdk.href} target="_blank" rel="noopener" class="integration-sdk-link">
          <span class="integration-sdk-lang">{t(sdk.lang)}</span>
          <span class="integration-sdk-pkg">{t(sdk.pkg)}</span>
          <span class="icon">open_in_new</span>
        </a>
      </li>
    ))}
  </ul>
);
