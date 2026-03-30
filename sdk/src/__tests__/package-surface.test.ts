// Copyright 2025 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("published package surface", () => {
  it("does not publish an internal admin entrypoint", () => {
    const packageJsonPath = resolve(__dirname, "../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).toBeDefined();
    expect(packageJson.exports?.["./internal"]).toBeUndefined();
  });
});
