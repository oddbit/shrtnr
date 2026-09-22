// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Splits a migration file into the statements D1 runs one at a time.
 *
 * D1's prepare() takes one statement, and batch() takes a list of them, so
 * the file has to be cut at statement boundaries. A semicolon marks a
 * boundary only outside string literals, quoted identifiers and comments,
 * which this scanner tracks character by character. A trigger body holds
 * statements of its own between BEGIN and END, and a cut there would hand D1
 * half a trigger, so the scanner refuses the construct instead of guessing.
 *
 * The generator (scripts/generate-migrations.ts) calls this at build time,
 * so a migration this cannot split fails the build, never a cold start.
 */

export class SqlSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqlSplitError";
  }
}

const TRIGGER_PATTERN = /\bCREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i;

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  const flush = (): void => {
    const trimmed = current.trim();
    if (trimmed) {
      if (TRIGGER_PATTERN.test(trimmed)) {
        throw new SqlSplitError(
          "CREATE TRIGGER is not supported in migrations: a trigger body holds inner semicolons that cannot be split into separate D1 statements.",
        );
      }
      statements.push(trimmed);
    }
    current = "";
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Line comment: drop through the end of the line, keep the newline so
    // the surrounding statement's layout survives.
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }

    // Block comment: drop through the closing marker.
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) throw new SqlSplitError("Unterminated block comment.");
      i = end + 2;
      continue;
    }

    // Quoted region: copy verbatim through the matching close quote. A
    // doubled quote character is an escape, not a close.
    if (ch === "'" || ch === '"' || ch === "`") {
      const close = ch;
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) throw new SqlSplitError(`Unterminated ${close} quote.`);
        if (sql[j] === close) {
          if (sql[j + 1] === close) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // Bracketed identifier: [name], no escaping inside.
    if (ch === "[") {
      const end = sql.indexOf("]", i);
      if (end === -1) throw new SqlSplitError("Unterminated [ identifier.");
      current += sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    if (ch === ";") {
      flush();
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  flush();
  return statements;
}
