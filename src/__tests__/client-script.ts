// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

/**
 * Helpers for the tests that exercise `adminClientScript()`'s output.
 *
 * The admin client ships as one generated script string, so a test that
 * wants to run a single handler has to cut it out of that string first.
 */

/**
 * Cuts one top-level declaration out of the generated client script.
 *
 * `startPattern` matches the declaration's opening line; the chunk runs to
 * the next line that starts at column zero with another top-level
 * declaration. The script is emitted with every nested line indented, so
 * column zero is a reliable boundary, but the terminator list has to keep
 * up: a helper in `src/client.ts` that begins with an unindented `const` or
 * `let` would be swallowed into the chunk before it.
 */
export function extractTopLevelChunk(source: string, startPattern: RegExp): string {
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => startPattern.test(l));
  if (startIdx === -1) throw new Error(`chunk not found: ${startPattern}`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^(function |var |if |window\.|document\.|const |let |class )/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}
