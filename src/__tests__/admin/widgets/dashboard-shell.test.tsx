// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { widgetsForPage } from "../../../admin/widgets/registry";
import { DashboardPage } from "../../../pages/dashboard";

describe("dashboard shell", () => {
  it("emits a placeholder for every registered dashboard widget", () => {
    const out = String(
      DashboardPage({ t: ((k: string) => k) as any, lang: "en", range: "30d" } as any),
    );
    for (const w of widgetsForPage("dashboard")) {
      expect(out).toContain(`hx-get="/_/admin/w/${w.id}?range=30d"`);
    }
  });
});
