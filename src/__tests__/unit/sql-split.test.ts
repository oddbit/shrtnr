// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { splitSqlStatements, SqlSplitError } from "../../db/sql-split";

describe("splitSqlStatements", () => {
  it("splits on semicolons and drops empty statements", () => {
    expect(splitSqlStatements("CREATE TABLE a (x);\n\nCREATE INDEX i ON a(x);\n")).toEqual([
      "CREATE TABLE a (x)",
      "CREATE INDEX i ON a(x)",
    ]);
  });

  it("emits a final statement that has no trailing semicolon", () => {
    expect(splitSqlStatements("SELECT 1;\nSELECT 2")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps a semicolon inside a single-quoted string literal", () => {
    expect(splitSqlStatements("INSERT INTO t VALUES ('a;b');\nSELECT 1;")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      "SELECT 1",
    ]);
  });

  it("treats a doubled quote as an escaped quote inside a literal", () => {
    expect(splitSqlStatements("INSERT INTO t VALUES ('it''s; fine');")).toEqual(["INSERT INTO t VALUES ('it''s; fine')"]);
  });

  it("keeps a semicolon inside a double-quoted identifier", () => {
    expect(splitSqlStatements('CREATE TABLE "odd;name" (x);')).toEqual(['CREATE TABLE "odd;name" (x)']);
  });

  it("strips line comments, including one that contains a semicolon", () => {
    const sql = "-- header; still a comment\nCREATE TABLE a (x); -- trailing; comment\nSELECT 1;";
    expect(splitSqlStatements(sql)).toEqual(["CREATE TABLE a (x)", "SELECT 1"]);
  });

  it("strips block comments, including one that contains a semicolon", () => {
    const sql = "/* one; two */ CREATE TABLE a (x); /* multi\nline; */ SELECT 1;";
    expect(splitSqlStatements(sql)).toEqual(["CREATE TABLE a (x)", "SELECT 1"]);
  });

  it("does not treat a comment marker inside a literal as a comment", () => {
    expect(splitSqlStatements("INSERT INTO t VALUES ('-- not a comment; really');")).toEqual([
      "INSERT INTO t VALUES ('-- not a comment; really')",
    ]);
  });

  it("returns no statements for a file that only holds comments", () => {
    expect(splitSqlStatements("-- nothing to do\n/* placeholder */\n")).toEqual([]);
  });

  it("collapses a statement that spans several lines into one string, keeping its inner layout", () => {
    const sql = "CREATE TABLE a (\n  x INTEGER,\n  y TEXT\n);";
    expect(splitSqlStatements(sql)).toEqual(["CREATE TABLE a (\n  x INTEGER,\n  y TEXT\n)"]);
  });

  it("rejects a trigger body, whose inner semicolons cannot be split safely", () => {
    const sql = "CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE a SET x = 1; END;";
    expect(() => splitSqlStatements(sql)).toThrow(SqlSplitError);
    expect(() => splitSqlStatements(sql)).toThrow(/TRIGGER/);
  });

  it("rejects an unterminated string literal", () => {
    expect(() => splitSqlStatements("INSERT INTO t VALUES ('open;")).toThrow(SqlSplitError);
  });

  it("rejects an unterminated block comment", () => {
    expect(() => splitSqlStatements("SELECT 1; /* never closed")).toThrow(SqlSplitError);
  });
});
