// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/preact";
import { setStorageItem, getClipboardMock } from "./setup";
import { ExtensionError } from "../src/errors";

let mockedShorten: ReturnType<typeof vi.fn<(url: string) => Promise<unknown>>>;
let mockedQr: ReturnType<typeof vi.fn<(id: number) => Promise<string>>>;

vi.mock("../src/api", async () => {
  return {
    isShortenable: (url: string) =>
      !!url &&
      (url.startsWith("http://") || url.startsWith("https://")) &&
      !url.startsWith("https://chrome:"),
    shortenUrl: (url: string) => mockedShorten(url),
    getQrSvg: (id: number) => mockedQr(id),
    testConnection: vi.fn(async () => undefined),
  };
});

beforeEach(() => {
  mockedShorten = vi.fn();
  mockedQr = vi.fn();
  cleanup();
});

async function renderPopup() {
  const { Popup } = await import("../src/popup/Popup");
  render(<Popup />);
}

describe("Popup — not configured", () => {
  it("renders the configure form when no config saved", async () => {
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeTruthy();
    });
    expect(mockedShorten).not.toHaveBeenCalled();
  });

  it("renders the deploy CTA when no config saved", async () => {
    await renderPopup();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /deploy/i }) as HTMLAnchorElement;
      expect(link.href).toContain("oddb.it/shrtnr-deploy-ext");
    });
  });
});

describe("Popup — success", () => {
  beforeEach(() => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    mockedShorten.mockResolvedValue({
      id: 42,
      slug: "abc",
      shortUrl: "https://x.com/abc",
    });
  });

  it("renders the short URL on success", async () => {
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText("https://x.com/abc")).toBeTruthy();
    });
  });

  it("auto-copies to clipboard on success", async () => {
    const clipboard = getClipboardMock();
    await renderPopup();
    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith("https://x.com/abc");
    });
  });

  it("Copy button re-copies", async () => {
    const clipboard = getClipboardMock();
    await renderPopup();
    const findCopyButton = () =>
      screen.getAllByRole("button").find((b) => /^(copy|copied)$/i.test(b.textContent?.trim() ?? ""));
    await waitFor(() => {
      expect(findCopyButton()).toBeTruthy();
    });
    clipboard.writeText.mockClear();
    fireEvent.click(findCopyButton()!);
    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith("https://x.com/abc");
    });
  });

  it("renders View in admin link to the right URL", async () => {
    await renderPopup();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /admin/i }) as HTMLAnchorElement;
      expect(link.href).toContain("/_/admin/links/42");
    });
  });
});

describe("Popup — QR toggle", () => {
  beforeEach(() => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
    mockedShorten.mockResolvedValue({
      id: 42,
      slug: "abc",
      shortUrl: "https://x.com/abc",
    });
    mockedQr.mockResolvedValue('<svg data-test="qr"/>');
  });

  it("first click fetches and renders the QR", async () => {
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => {
      expect(mockedQr).toHaveBeenCalledTimes(1);
      expect(mockedQr).toHaveBeenCalledWith(42);
    });
  });

  it("second click hides without refetching", async () => {
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => screen.getByRole("button", { name: /hide qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /hide qr/i }));
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    expect(mockedQr).toHaveBeenCalledTimes(1);
  });

  it("third click (re-show) reuses cached SVG", async () => {
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => screen.getByRole("button", { name: /hide qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /hide qr/i }));
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => screen.getByRole("button", { name: /hide qr/i }));
    expect(mockedQr).toHaveBeenCalledTimes(1);
  });

  it("does not revert an in-flight QR toggle when a slower Copy again resolves later", async () => {
    const clipboard = getClipboardMock();

    // The initial auto-copy fails, so copyStatus starts as "failed" (distinct
    // from "fresh"). That gives a clean signal later for exactly when the
    // second (copyAgain) call resolves, instead of racing against it.
    let callCount = 0;
    let resolveCopy!: () => void;
    clipboard.writeText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("boom"));
      return new Promise<void>((resolve) => { resolveCopy = resolve; });
    });

    await renderPopup();
    await waitFor(() => screen.getByRole("alert"));

    const findCopyButton = () =>
      screen.getAllByRole("button").find((b) => /^copy$/i.test(b.textContent?.trim() ?? ""));
    fireEvent.click(findCopyButton()!); // copyAgain: pending on the controlled promise

    // While copyAgain is still pending, open the QR panel. This sets
    // qr.visible synchronously, before copyAgain's stale closure resolves.
    await waitFor(() => screen.getByRole("button", { name: /show qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /show qr/i }));
    await waitFor(() => screen.getByRole("button", { name: /hide qr/i }));

    // Now let copyAgain resolve. Before the fix, its
    // setState({ ...state, copyStatus: "fresh" }) used a pre-QR-toggle
    // snapshot of state and clobbered qr back to { visible: false }.
    resolveCopy();
    await waitFor(() => screen.getByRole("status")); // copyStatus flips to "fresh" (the ✓ copied toast)

    expect(screen.getByRole("button", { name: /hide qr/i })).toBeTruthy();
  });
});

describe("Popup — error states", () => {
  beforeEach(() => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
  });

  it("renders internal-page error without calling shorten when tab URL is internal", async () => {
    chrome.tabs.query = vi.fn(async () => [
      { url: "chrome://newtab", id: 1, active: true } as chrome.tabs.Tab,
    ]);
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText(/internal browser pages/i)).toBeTruthy();
    });
    expect(mockedShorten).not.toHaveBeenCalled();
  });

  it("renders unauthorized error and Open settings recovery on 401", async () => {
    mockedShorten.mockRejectedValue(new ExtensionError("unauthorized", "bad key", 401));
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText(/api key was rejected/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /settings/i })).toBeTruthy();
  });

  it("renders network error and offers Retry on status 0", async () => {
    mockedShorten.mockRejectedValue(new ExtensionError("network"));
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText(/can't reach/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("renders server error on 5xx", async () => {
    mockedShorten.mockRejectedValue(new ExtensionError("server", "boom", 503));
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText(/returned an error/i)).toBeTruthy();
    });
  });

  it("renders validation error using server message directly", async () => {
    mockedShorten.mockRejectedValue(new ExtensionError("validation", "URL too long", 422));
    await renderPopup();
    await waitFor(() => {
      expect(screen.getByText(/URL too long/i)).toBeTruthy();
    });
  });
});

describe("Popup — recovery", () => {
  beforeEach(() => {
    setStorageItem("config", { baseUrl: "https://x.com", apiKey: "sk_abc" });
  });

  it("Retry button re-runs the shorten flow", async () => {
    mockedShorten
      .mockRejectedValueOnce(new ExtensionError("network"))
      .mockResolvedValueOnce({ id: 7, slug: "xyz", shortUrl: "https://x.com/xyz" });
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /retry/i }));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText("https://x.com/xyz")).toBeTruthy();
    });
  });

  it("Open settings opens the options page", async () => {
    mockedShorten.mockRejectedValue(new ExtensionError("unauthorized", "x", 401));
    await renderPopup();
    await waitFor(() => screen.getByRole("button", { name: /settings/i }));
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
