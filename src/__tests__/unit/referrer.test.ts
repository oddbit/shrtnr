// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  APP_PACKAGE_TO_DOMAIN,
  isBareOriginSelfReferrer,
  mapAppPackage,
  normalizeHost,
  parseAppReferrer,
  parseReferrerHost,
} from "../../referrer";

describe("normalizeHost", () => {
  it("lowercases and strips a leading www.", () => {
    expect(normalizeHost("WWW.LinkedIn.com")).toBe("linkedin.com");
  });

  it("preserves meaningful subdomains", () => {
    expect(normalizeHost("firebase.google.com")).toBe("firebase.google.com");
  });

  it("preserves country-code second-level domains", () => {
    expect(normalizeHost("somedomain.co.uk")).toBe("somedomain.co.uk");
  });
});

describe("parseAppReferrer", () => {
  it("extracts the package name from android-app://pkg/", () => {
    expect(parseAppReferrer("android-app://com.linkedin.android/")).toEqual({
      packageName: "com.linkedin.android",
    });
  });

  it("extracts the package name from android-app://pkg without a trailing slash", () => {
    expect(parseAppReferrer("android-app://com.linkedin.android")).toEqual({
      packageName: "com.linkedin.android",
    });
  });

  it("extracts the package name from ios-app://bundle.id/", () => {
    expect(parseAppReferrer("ios-app://com.linkedin.LinkedIn/")).toEqual({
      packageName: "com.linkedin.LinkedIn",
    });
  });

  it("returns null for a regular https URL", () => {
    expect(parseAppReferrer("https://linkedin.com/feed")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseAppReferrer("")).toBeNull();
  });

  it("returns null when the scheme has no package after the //", () => {
    expect(parseAppReferrer("android-app://")).toBeNull();
  });
});

describe("mapAppPackage", () => {
  it("maps a known package to its brand domain", () => {
    expect(mapAppPackage("com.linkedin.android")).toBe("linkedin.com");
  });

  it("returns null for an unknown package (uncurated app)", () => {
    expect(mapAppPackage("com.some.obscure.app")).toBeNull();
  });

  it("returns null for a known browser package (treated as noise)", () => {
    // Browsers are deliberately absent from the map; they fall through to null.
    expect(mapAppPackage("com.android.chrome")).toBeNull();
    expect(mapAppPackage("com.sec.android.app.sbrowser")).toBeNull();
  });

  it("includes the curated v1 social/messaging brands", () => {
    // Spot-check a few representative entries so the map is not silently emptied.
    expect(APP_PACKAGE_TO_DOMAIN["com.linkedin.android"]).toBe("linkedin.com");
    expect(APP_PACKAGE_TO_DOMAIN["com.twitter.android"]).toBe("x.com");
    expect(APP_PACKAGE_TO_DOMAIN["com.facebook.katana"]).toBe("facebook.com");
    expect(APP_PACKAGE_TO_DOMAIN["com.instagram.android"]).toBe("instagram.com");
    expect(APP_PACKAGE_TO_DOMAIN["com.zhiliaoapp.musically"]).toBe("tiktok.com");
    expect(APP_PACKAGE_TO_DOMAIN["com.reddit.frontpage"]).toBe("reddit.com");
  });
});

describe("parseReferrerHost", () => {
  it("returns null for a null/empty referrer", () => {
    expect(parseReferrerHost(null)).toBeNull();
    expect(parseReferrerHost("")).toBeNull();
  });

  it("normalizes a regular https URL hostname (existing behavior)", () => {
    expect(parseReferrerHost("https://www.linkedin.com/feed")).toBe("linkedin.com");
  });

  it("preserves meaningful subdomains in regular URLs", () => {
    expect(parseReferrerHost("https://firebase.google.com/docs")).toBe("firebase.google.com");
  });

  it("returns the brand domain for a known android-app package", () => {
    expect(parseReferrerHost("android-app://com.linkedin.android/")).toBe("linkedin.com");
  });

  it("returns null for an uncurated android-app package (preserves raw for future review)", () => {
    expect(parseReferrerHost("android-app://com.some.obscure.app/")).toBeNull();
  });

  it("returns null for a known android browser package", () => {
    expect(parseReferrerHost("android-app://com.android.chrome/")).toBeNull();
    expect(parseReferrerHost("android-app://com.sec.android.app.sbrowser/")).toBeNull();
  });

  it("returns null for a malformed URL (existing behavior)", () => {
    expect(parseReferrerHost("not a url")).toBeNull();
  });
});

describe("isBareOriginSelfReferrer", () => {
  it("flags exact bare-origin same-host referrers", () => {
    expect(isBareOriginSelfReferrer("https://shrtnr.test/", "shrtnr.test")).toBe(true);
  });

  it("does not flag same-host referrers with a meaningful path", () => {
    expect(isBareOriginSelfReferrer("https://shrtnr.test/_/admin/settings", "shrtnr.test")).toBe(false);
  });

  it("does not flag cross-origin referrers", () => {
    expect(isBareOriginSelfReferrer("https://oddbit.id/projects", "shrtnr.test")).toBe(false);
  });

  it("flags www.same-host as the same host", () => {
    expect(isBareOriginSelfReferrer("https://www.shrtnr.test/", "shrtnr.test")).toBe(true);
  });

  it("does not flag bare-origin with a query string", () => {
    expect(isBareOriginSelfReferrer("https://shrtnr.test/?utm=x", "shrtnr.test")).toBe(false);
  });

  it("returns false for null referrer", () => {
    expect(isBareOriginSelfReferrer(null, "shrtnr.test")).toBe(false);
  });
});
