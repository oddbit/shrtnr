// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { BrowserContext, Page } from "@playwright/test";

/**
 * Measurement helpers for the browser performance spec.
 *
 * The observers install before any page script runs (addInitScript) and
 * buffer the entries the Core Web Vitals are computed from; collectVitals()
 * reads them back once the page has settled. Byte counts come from the
 * Chrome DevTools Protocol, since the browser reports encoded sizes for
 * cross-origin responses (fonts) only there.
 */

export interface Vitals {
  /** Time to first byte of the document, ms. */
  ttfb: number;
  /** First contentful paint, ms. */
  fcp: number | null;
  /** Largest contentful paint, ms, with the element that produced it. */
  lcp: number | null;
  lcpElement: string | null;
  /** Cumulative layout shift, unitless. */
  cls: number;
  /** Total blocking time: long-task time beyond 50 ms each, ms. */
  tbt: number;
  /** Uncompressed size of the document and its inline CSS and JS, bytes. */
  documentBytes: number;
  inlineStyleBytes: number;
  inlineScriptBytes: number;
}

export interface ResponseRecord {
  url: string;
  status: number;
  type: string;
  /** Bytes on the wire, after compression. */
  encodedBytes: number;
  cacheControl: string | undefined;
}

export const VITALS_INIT_SCRIPT = `
(() => {
  const v = { lcp: null, lcpElement: null, cls: 0, longTasks: [] };
  window.__vitals = v;
  const describe = (el) => {
    if (!el) return null;
    const cls = el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : '';
    return el.tagName + (el.id ? '#' + el.id : '') + cls;
  };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { v.lcp = e.startTime; v.lcpElement = describe(e.element); }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) v.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) v.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch (err) { window.__vitalsError = String(err); }
})();
`;

/** Reads the buffered observers back. Call after the page has settled. */
export async function collectVitals(page: Page): Promise<Vitals> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const v = (window as unknown as { __vitals: { lcp: number | null; lcpElement: string | null; cls: number; longTasks: number[] } }).__vitals;
    const sum = (nodes: NodeListOf<Element>) => [...nodes].reduce((n, el) => n + (el.textContent?.length ?? 0), 0);
    return {
      ttfb: Math.round(nav.responseStart),
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: v.lcp == null ? null : Math.round(v.lcp),
      lcpElement: v.lcpElement,
      cls: Number(v.cls.toFixed(4)),
      tbt: Math.round(v.longTasks.reduce((n, d) => n + Math.max(0, d - 50), 0)),
      documentBytes: nav.decodedBodySize,
      inlineStyleBytes: sum(document.querySelectorAll("style")),
      inlineScriptBytes: sum(document.querySelectorAll("script:not([src])")),
    };
  });
}

/**
 * Records every response the page receives, with its size on the wire.
 * Returns a function that hands back the records collected so far.
 */
export async function recordResponses(context: BrowserContext, page: Page): Promise<() => ResponseRecord[]> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const byId = new Map<string, ResponseRecord>();
  cdp.on("Network.responseReceived", (e) => {
    const headers = e.response.headers as Record<string, string>;
    byId.set(e.requestId, {
      url: e.response.url,
      status: e.response.status,
      type: e.type,
      encodedBytes: 0,
      cacheControl: headers["cache-control"] ?? headers["Cache-Control"],
    });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = byId.get(e.requestId);
    if (r) r.encodedBytes = e.encodedDataLength;
  });
  return () => [...byId.values()];
}

/**
 * A slow phone on a poor connection: Chrome's "Fast 3G" profile with a 4x
 * CPU slowdown. Timing under this profile is informational: it shows what a
 * user meets, but the numbers vary too much run to run to fail a build on.
 */
export async function throttle(context: BrowserContext, page: Page): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

export const kb = (bytes: number): string => `${(bytes / 1024).toFixed(0)} KB`;

/** One line per page for the run log, so a reviewer sees the numbers without opening a report. */
export function formatVitals(name: string, v: Vitals, wireBytes?: number): string {
  const cells = [
    name.padEnd(22),
    `ttfb ${String(v.ttfb).padStart(4)}ms`,
    `fcp ${String(v.fcp ?? "-").padStart(4)}ms`,
    `lcp ${String(v.lcp ?? "-").padStart(4)}ms`,
    `cls ${v.cls.toFixed(3)}`,
    `tbt ${String(v.tbt).padStart(3)}ms`,
    wireBytes == null ? "" : `wire ${kb(wireBytes).padStart(7)}`,
  ];
  return cells.join("  ").trimEnd();
}
