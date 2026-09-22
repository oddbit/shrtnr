// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Pins src/db/migrations.generated.ts to migrations/*.sql. The Worker boots
 * from the generated module, so a migration edited without rerunning the
 * generator would ship a schema that differs from what the CLI applies.
 * This fails the suite instead.
 */

import { describe, it, expect } from "vitest";
import { MIGRATIONS, SCHEMA_VERSION } from "../../db/migrations.generated";
import { renderMigrationsModule } from "../../../scripts/render-migrations";
import { splitSqlStatements } from "../../db/sql-split";

const sqlFiles = import.meta.glob("../../../migrations/*.sql", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const generatedSource = import.meta.glob("../../db/migrations.generated.ts", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

const files = Object.entries(sqlFiles)
  .map(([path, sql]) => ({ name: path.slice(path.lastIndexOf("/") + 1), sql }))
  .sort((a, b) => a.name.localeCompare(b.name));

describe("migrations.generated.ts", () => {
  it("lists every migration file, in file name order", () => {
    expect(MIGRATIONS.map((m) => m.name)).toEqual(files.map((f) => f.name));
  });

  it("carries the statements the splitter produces from each file", () => {
    for (const [i, file] of files.entries()) {
      expect(MIGRATIONS[i].statements, file.name).toEqual(splitSqlStatements(file.sql));
    }
  });

  it("reports the last migration as the schema version", () => {
    expect(SCHEMA_VERSION).toBe(files[files.length - 1].name);
  });

  it("matches the generator's output byte for byte", () => {
    const [source] = Object.values(generatedSource);
    expect(source).toBe(renderMigrationsModule(files));
  });
});
