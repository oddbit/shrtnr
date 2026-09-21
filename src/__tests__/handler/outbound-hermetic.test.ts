// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

// The suite must never reach the network. vitest.config.mts routes every
// outbound fetch through a miniflare outboundService stub; this pins that
// wiring so a later config edit cannot silently reopen the network path.
//
// Why it matters: every link a handler test creates schedules
// autoLabelLink() in waitUntil, which fetches the link's URL for a <title>.
// Before the stub those fetches left the sandbox for real. workerd logged
// DNS failures and TLS handshake errors against parked domains, one stalled
// handshake carried a test past vitest's 5s timeout in CI, and because
// SELF.fetch does not wait on waitUntil, a slow fetch outlived its test and
// wrote a label into the next test's rolled-back storage.
import { describe, expect, it } from "vitest";
import { fetchPageTitle } from "../../title-fetch";

// A host that exists and would answer a real request. If the stub is not in
// place this test either takes seconds or fails on the body assertion.
const REAL_HOST_URL = "https://custom-target.com/";

describe("outbound fetch is stubbed for the whole suite", () => {
  it("answers a global fetch() with the config stub, not the network", async () => {
    const res = await fetch(REAL_HOST_URL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(await res.text()).toBe(`outbound fetch stubbed by vitest.config.mts: ${REAL_HOST_URL}`);
  });

  it("makes fetchPageTitle() return null so autoLabelLink() writes nothing", async () => {
    // Unstubbed on purpose: this is the path the handler tests exercise
    // through waitUntil. The stub body is text/plain, so the title
    // extractor bails before reading a body.
    const started = Date.now();
    expect(await fetchPageTitle(REAL_HOST_URL)).toBeNull();
    // Well inside the 5s test timeout that the real handshake blew through.
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
