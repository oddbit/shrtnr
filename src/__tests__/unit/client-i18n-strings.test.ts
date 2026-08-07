// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// Guards against hardcoded UI strings creeping back into the admin client
// script: every user-facing string must flow through t(), per CLAUDE.md's
// i18n rule, so a translated locale actually changes what is shown.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";

describe("adminClientScript i18n coverage", () => {
  it("routes slug-action error toasts through t() instead of a hardcoded 'Error'", () => {
    const script = adminClientScript("1.0.0", {} as unknown as Translations);

    expect(script).not.toContain("|| 'Error'");
    expect(script).toContain("t('client.setPrimaryError')");
    expect(script).toContain("t('client.deleteSlugError')");
    expect(script).toContain("t('client.disableSlugError')");
    expect(script).toContain("t('client.enableSlugError')");
  });

  it("routes the add-slug modal's field label through t() instead of a hardcoded 'Slug'", () => {
    const script = adminClientScript("1.0.0", {} as unknown as Translations);

    expect(script).not.toContain('form-label">Slug</label>');
    expect(script).toContain("t('linkDetail.slugFieldLabel')");
  });
});
