// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The copy button and the QR modal run in the browser, which cannot read the
// Worker's environment, so the pinned origin reaches them as an attribute on
// the admin document. This runs the client script's own shortOrigin() helper
// against a stub document, which is the half of the rule the server cannot
// test: the page tests prove the attribute is rendered, this proves the
// script prefers it and still falls back to the host the admin was opened on.
import { describe, expect, it } from "vitest";
import { adminClientScript } from "../../client";
import type { Translations } from "../../i18n/types";
import { extractTopLevelChunk } from "../client-script";

function loadShortOrigin(attribute: string | null, origin: string): () => string {
  const script = adminClientScript("1.0.0", {} as unknown as Translations);
  const code = [extractTopLevelChunk(script, /^function shortOrigin\(/), "return shortOrigin;"].join("\n");
  const documentElement = {
    getAttribute: (name: string) => (name === "data-short-origin" ? attribute : null),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function("document", "location", code) as (d: unknown, l: unknown) => () => string;
  return factory({ documentElement }, { origin });
}

describe("client.ts shortOrigin()", () => {
  it("prefers the origin the server pinned", () => {
    expect(loadShortOrigin("https://c.example", "http://localhost:8797")()).toBe("https://c.example");
  });

  it("falls back to the host the admin was opened on", () => {
    expect(loadShortOrigin(null, "http://localhost:8797")()).toBe("http://localhost:8797");
  });

  it("treats an empty attribute as unset", () => {
    expect(loadShortOrigin("", "http://localhost:8797")()).toBe("http://localhost:8797");
  });
});
