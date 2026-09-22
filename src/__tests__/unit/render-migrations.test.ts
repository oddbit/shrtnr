// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { renderMigrationsModule } from "../../../scripts/render-migrations";

const files = [
  { name: "0002_second.sql", sql: "CREATE INDEX i ON a(x);" },
  { name: "0001_first.sql", sql: "-- comment\nCREATE TABLE a (x);\nINSERT INTO a VALUES (1);" },
];

describe("renderMigrationsModule", () => {
  it("marks the module as generated and names its source", () => {
    const out = renderMigrationsModule(files);
    expect(out).toMatch(/generated/i);
    expect(out).toContain("scripts/generate-migrations.ts");
    expect(out).toContain("do not edit");
  });

  it("orders migrations by file name whatever order it receives them in", () => {
    const out = renderMigrationsModule(files);
    expect(out.indexOf("0001_first.sql")).toBeLessThan(out.indexOf("0002_second.sql"));
  });

  it("emits each file's statements split at statement boundaries", () => {
    const out = renderMigrationsModule(files);
    expect(out).toContain("`CREATE TABLE a (x)`");
    expect(out).toContain("`INSERT INTO a VALUES (1)`");
    expect(out).not.toContain("-- comment");
  });

  it("sets SCHEMA_VERSION to the last migration name", () => {
    const out = renderMigrationsModule(files);
    expect(out).toContain('export const SCHEMA_VERSION = "0002_second.sql"');
  });

  it("escapes backticks, template placeholders and backslashes inside SQL", () => {
    const out = renderMigrationsModule([{ name: "0001_x.sql", sql: "INSERT INTO t VALUES ('`tick` ${x} back\\slash');" }]);
    expect(out).toContain("\\`tick\\`");
    expect(out).toContain("\\${x}");
    expect(out).toContain("back\\\\slash");
  });

  it("refuses to render an empty migration set", () => {
    expect(() => renderMigrationsModule([])).toThrow(/no migrations/i);
  });

  it("refuses a file that is not a .sql migration", () => {
    expect(() => renderMigrationsModule([{ name: "notes.txt", sql: "SELECT 1;" }])).toThrow(/notes\.txt/);
  });

  it("names the file when a migration cannot be split", () => {
    const trigger = "CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE a SET x = 1; END;";
    expect(() => renderMigrationsModule([{ name: "0009_trigger.sql", sql: trigger }])).toThrow(/0009_trigger\.sql/);
  });
});
